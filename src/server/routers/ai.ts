import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc/trpc";
import Anthropic from "@anthropic-ai/sdk";
import { startOfDay, endOfDay, subDays, format } from "date-fns";
import { prisma as prismaClient } from "@/lib/prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type PrismaClient = typeof prismaClient;

async function buildFinancialContext(prisma: PrismaClient, tenantId: string) {
  const today = new Date();
  const from = startOfDay(today);
  const to = endOfDay(today);
  const last7From = startOfDay(subDays(today, 7));

  const [todaySales, todayExpenses, recentInvoices, recentExpenses] =
    await Promise.all([
      prisma.salesTransaction.aggregate({
        where: { tenantId, transactedAt: { gte: from, lte: to } },
        _sum: { netAmount: true },
        _count: true,
      }),
      prisma.expense.aggregate({
        where: { tenantId, isDeleted: false, expenseDate: { gte: from, lte: to } },
        _sum: { amount: true },
      }),
      prisma.purchaseInvoice.findMany({
        where: { tenantId, isDeleted: false, createdAt: { gte: last7From } },
        take: 10,
        orderBy: { createdAt: "desc" },
        select: { supplierName: true, totalAmount: true, invoiceDate: true, category: true },
      }),
      prisma.expense.findMany({
        where: { tenantId, isDeleted: false, expenseDate: { gte: last7From } },
        take: 10,
        orderBy: { expenseDate: "desc" },
        select: { category: true, amount: true, expenseDate: true, description: true },
      }),
    ]);

  const totalSales = Number(todaySales._sum.netAmount ?? 0);
  const totalExpenses = Number(todayExpenses._sum.amount ?? 0);
  const grossProfit = totalSales - totalExpenses;

  return {
    today: format(today, "yyyy-MM-dd"),
    todaySales: totalSales,
    todayExpenses: totalExpenses,
    todayGrossProfit: grossProfit,
    orderCount: todaySales._count,
    recentInvoices: recentInvoices.map((i) => ({
      supplier: i.supplierName,
      amount: Number(i.totalAmount ?? 0),
      category: i.category,
      date: i.invoiceDate ? format(i.invoiceDate, "yyyy-MM-dd") : null,
    })),
    recentExpenses: recentExpenses.map((e) => ({
      category: e.category,
      amount: Number(e.amount),
      date: format(e.expenseDate, "yyyy-MM-dd"),
      description: e.description,
    })),
  };
}

export const aiRouter = createTRPCRouter({
  listConversations: tenantProcedure.query(async ({ ctx }) => {
    return ctx.prisma.conversation.findMany({
      where: { tenantId: ctx.tenant.id, userId: ctx.dbUser.id },
      orderBy: { updatedAt: "desc" },
      take: 20,
      include: { messages: { take: 1, orderBy: { createdAt: "desc" } } },
    });
  }),

  getConversation: tenantProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.conversation.findFirst({
        where: {
          id: input.conversationId,
          tenantId: ctx.tenant.id,
          userId: ctx.dbUser.id,
        },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
    }),

  chat: tenantProcedure
    .input(
      z.object({
        conversationId: z.string().optional(),
        message: z.string().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const financialContext = await buildFinancialContext(ctx.prisma as PrismaClient, ctx.tenant.id);

      let conversation = input.conversationId
        ? await ctx.prisma.conversation.findFirst({
            where: {
              id: input.conversationId,
              tenantId: ctx.tenant.id,
              userId: ctx.dbUser.id,
            },
            include: { messages: { orderBy: { createdAt: "asc" } } },
          })
        : null;

      if (!conversation) {
        conversation = await ctx.prisma.conversation.create({
          data: {
            tenantId: ctx.tenant.id,
            userId: ctx.dbUser.id,
            title: input.message.slice(0, 60),
          },
          include: { messages: true },
        });
      }

      await ctx.prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "user",
          content: input.message,
        },
      });

      const systemPrompt = `You are the AI CFO assistant for a restaurant business using Madar AI.
You help restaurant owners understand their financial performance. Speak conversationally — no accounting jargon.
Always answer in the same language the owner uses (Arabic or English).

Current financial data:
${JSON.stringify(financialContext, null, 2)}

Guidelines:
- Give direct, actionable answers
- Reference actual numbers from the data above
- If asked about something not in the data, say so clearly
- Keep responses concise and practical
- Format numbers in SAR currency`;

      const messages = (conversation.messages ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      messages.push({ role: "user", content: input.message });

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });

      const assistantContent =
        response.content[0].type === "text" ? response.content[0].text : "";

      const assistantMessage = await ctx.prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: assistantContent,
          sources: financialContext as object,
        },
      });

      await ctx.prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      return {
        conversationId: conversation.id,
        message: assistantMessage,
      };
    }),

  generateInsights: tenantProcedure.mutation(async ({ ctx }) => {
    const financialContext = await buildFinancialContext(ctx.prisma as PrismaClient, ctx.tenant.id);

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `Based on this restaurant financial data, generate 3 key business insights. Return JSON array with objects having: title, body, type (PROFIT_SUMMARY|COST_WARNING|SALES_TREND|GENERAL), severity (info|warning|critical).

Data: ${JSON.stringify(financialContext)}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "[]";

    let insights: Array<{
      title: string;
      body: string;
      type: string;
      severity: string;
    }> = [];

    try {
      const match = text.match(/\[[\s\S]*\]/);
      if (match) insights = JSON.parse(match[0]);
    } catch {
      // fallback
    }

    const created = await Promise.all(
      insights.map((insight) =>
        ctx.prisma.insight.create({
          data: {
            tenantId: ctx.tenant.id,
            type: insight.type as import("@prisma/client").InsightType,
            title: insight.title,
            body: insight.body,
            severity: insight.severity,
          },
        })
      )
    );

    return created;
  }),

  listInsights: tenantProcedure
    .input(z.object({ limit: z.number().default(10), unreadOnly: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.insight.findMany({
        where: {
          tenantId: ctx.tenant.id,
          ...(input.unreadOnly && { isRead: false }),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  markInsightRead: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.insight.update({
        where: { id: input.id, tenantId: ctx.tenant.id },
        data: { isRead: true },
      });
    }),
});
