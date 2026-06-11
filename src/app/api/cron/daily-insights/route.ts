import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { startOfDay, endOfDay, subDays, format } from "date-fns";

export const runtime = "nodejs";
export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenants = await prisma.tenant.findMany({
    where: { restaurant: { isNot: null } },
    select: { id: true },
  });

  const results: Array<{ tenantId: string; insightsCreated: number }> = [];

  for (const { id: tenantId } of tenants) {
    try {
      const today = new Date();
      const from = startOfDay(subDays(today, 1));
      const to = endOfDay(subDays(today, 1));

      const [sales, expenses, invoices] = await Promise.all([
        prisma.salesTransaction.aggregate({
          where: { tenantId, transactedAt: { gte: from, lte: to } },
          _sum: { netAmount: true },
          _count: true,
        }),
        prisma.expense.aggregate({
          where: { tenantId, isDeleted: false, expenseDate: { gte: from, lte: to } },
          _sum: { amount: true },
        }),
        prisma.purchaseInvoice.aggregate({
          where: { tenantId, isDeleted: false, status: "APPROVED", invoiceDate: { gte: from, lte: to } },
          _sum: { totalAmount: true },
        }),
      ]);

      const totalSales = Number(sales._sum.netAmount ?? 0);
      const totalExpenses = Number(expenses._sum.amount ?? 0);
      const totalPurchases = Number(invoices._sum.totalAmount ?? 0);
      const profit = totalSales - totalExpenses - totalPurchases;
      const margin = totalSales > 0 ? ((profit / totalSales) * 100).toFixed(1) : "0";

      if (totalSales === 0 && totalExpenses === 0) {
        results.push({ tenantId, insightsCreated: 0 });
        continue;
      }

      const prompt = `Restaurant data for ${format(subDays(today, 1), "yyyy-MM-dd")}:
Sales: ${totalSales} SAR (${sales._count} orders)
Expenses: ${totalExpenses} SAR
Purchases: ${totalPurchases} SAR
Net Profit: ${profit} SAR
Margin: ${margin}%

Generate exactly 2 brief business insights in Arabic. Return JSON array:
[{"title":"string","body":"string (max 80 chars)","type":"PROFIT_SUMMARY|COST_WARNING|SALES_TREND|GENERAL","severity":"info|warning|critical"}]
Only JSON, no explanation.`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "[]";
      let parsed: Array<{ title: string; body: string; type: string; severity: string }> = [];
      try {
        const match = text.match(/\[[\s\S]*\]/);
        if (match) parsed = JSON.parse(match[0]);
      } catch { /* skip */ }

      for (const insight of parsed) {
        await prisma.insight.create({
          data: {
            tenantId,
            type: insight.type as "PROFIT_SUMMARY" | "COST_WARNING" | "SALES_TREND" | "SUPPLIER_ALERT" | "FORECAST" | "GENERAL",
            title: insight.title,
            body: insight.body,
            severity: insight.severity,
          },
        });
      }

      // Create notification for low margin
      if (Number(margin) < 10 && totalSales > 0) {
        await prisma.notification.create({
          data: {
            tenantId,
            title: "⚠️ هامش الربح منخفض",
            body: `هامش الربح أمس كان ${margin}% فقط. تحقق من المصروفات.`,
            type: "warning",
          },
        });
      }

      results.push({ tenantId, insightsCreated: parsed.length });
    } catch {
      results.push({ tenantId, insightsCreated: 0 });
    }
  }

  return NextResponse.json({ processed: tenants.length, results });
}
