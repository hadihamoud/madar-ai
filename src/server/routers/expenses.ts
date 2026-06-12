import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc/trpc";
import { ExpenseCategory } from "@prisma/client";

export const expensesRouter = createTRPCRouter({
  list: tenantProcedure
    .input(
      z.object({
        from: z.date().optional(),
        to: z.date().optional(),
        category: z.nativeEnum(ExpenseCategory).optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        tenantId: ctx.tenant.id,
        isDeleted: false,
        ...(input.category && { category: input.category }),
        ...(input.from || input.to
          ? {
              expenseDate: {
                ...(input.from && { gte: input.from }),
                ...(input.to && { lte: input.to }),
              },
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.expense.findMany({
          where,
          orderBy: { expenseDate: "desc" },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.expense.count({ where }),
      ]);

      return { items, total };
    }),

  create: tenantProcedure
    .input(
      z.object({
        category: z.nativeEnum(ExpenseCategory),
        description: z.string().optional(),
        amount: z.number().positive(),
        currency: z.string().default("SAR"),
        expenseDate: z.date(),
        receiptUrl: z.string().url().optional(),
        isRecurring: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const expense = await ctx.prisma.expense.create({
        data: { tenantId: ctx.tenant.id, ...input },
      });
      await ctx.prisma.auditLog.create({
        data: {
          tenantId: ctx.tenant.id,
          userId: ctx.dbUser.id,
          action: "CREATE",
          entity: "Expense",
          entityId: expense.id,
          after: expense as object,
        },
      });
      return expense;
    }),

  update: tenantProcedure
    .input(
      z.object({
        id: z.string(),
        category: z.nativeEnum(ExpenseCategory).optional(),
        description: z.string().optional(),
        amount: z.number().positive().optional(),
        expenseDate: z.date().optional(),
        isRecurring: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.expense.update({
        where: { id, tenantId: ctx.tenant.id },
        data,
      });
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.expense.update({
        where: { id: input.id, tenantId: ctx.tenant.id },
        data: { isDeleted: true },
      });
    }),

  summary: tenantProcedure
    .input(z.object({ from: z.date(), to: z.date() }))
    .query(async ({ ctx, input }) => {
      const expenses = await ctx.prisma.expense.findMany({
        where: {
          tenantId: ctx.tenant.id,
          isDeleted: false,
          expenseDate: { gte: input.from, lte: input.to },
        },
      });

      const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
      const byCategory = expenses.reduce(
        (acc, e) => {
          acc[e.category] = (acc[e.category] ?? 0) + Number(e.amount);
          return acc;
        },
        {} as Record<string, number>
      );

      return { total, byCategory, count: expenses.length };
    }),
});
