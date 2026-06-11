import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc/trpc";
import { startOfDay, endOfDay, eachDayOfInterval, format } from "date-fns";

export const reportsRouter = createTRPCRouter({
  // Daily breakdown for a date range (for charts)
  dailyBreakdown: tenantProcedure
    .input(z.object({ from: z.date(), to: z.date() }))
    .query(async ({ ctx, input }) => {
      const days = eachDayOfInterval({ start: input.from, end: input.to });
      const tenantId = ctx.tenant.id;

      const [allSales, allExpenses, allInvoices] = await Promise.all([
        ctx.prisma.salesTransaction.findMany({
          where: { tenantId, transactedAt: { gte: input.from, lte: input.to } },
          select: { netAmount: true, transactedAt: true },
        }),
        ctx.prisma.expense.findMany({
          where: { tenantId, isDeleted: false, expenseDate: { gte: input.from, lte: input.to } },
          select: { amount: true, expenseDate: true },
        }),
        ctx.prisma.purchaseInvoice.findMany({
          where: {
            tenantId,
            isDeleted: false,
            status: "APPROVED",
            invoiceDate: { gte: input.from, lte: input.to },
          },
          select: { totalAmount: true, invoiceDate: true },
        }),
      ]);

      return days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const sales = allSales
          .filter((s) => format(new Date(s.transactedAt), "yyyy-MM-dd") === dayStr)
          .reduce((sum, s) => sum + Number(s.netAmount), 0);
        const expenses = allExpenses
          .filter((e) => format(new Date(e.expenseDate), "yyyy-MM-dd") === dayStr)
          .reduce((sum, e) => sum + Number(e.amount), 0);
        const purchases = allInvoices
          .filter((i) => i.invoiceDate && format(new Date(i.invoiceDate), "yyyy-MM-dd") === dayStr)
          .reduce((sum, i) => sum + Number(i.totalAmount ?? 0), 0);
        const costs = expenses + purchases;
        return {
          date: dayStr,
          label: format(day, "d/M"),
          sales,
          costs,
          profit: sales - costs,
        };
      });
    }),

  // Expense breakdown by category for a period
  expenseByCategory: tenantProcedure
    .input(z.object({ from: z.date(), to: z.date() }))
    .query(async ({ ctx, input }) => {
      const expenses = await ctx.prisma.expense.groupBy({
        by: ["category"],
        where: {
          tenantId: ctx.tenant.id,
          isDeleted: false,
          expenseDate: { gte: input.from, lte: input.to },
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: "desc" } },
      });

      const total = expenses.reduce((sum, e) => sum + Number(e._sum.amount ?? 0), 0);
      return expenses.map((e) => ({
        category: e.category,
        amount: Number(e._sum.amount ?? 0),
        count: e._count,
        percentage: total > 0 ? Math.round((Number(e._sum.amount ?? 0) / total) * 100) : 0,
      }));
    }),

  // Top suppliers by spend for a period
  topSuppliers: tenantProcedure
    .input(z.object({ from: z.date(), to: z.date(), limit: z.number().default(5) }))
    .query(async ({ ctx, input }) => {
      const invoices = await ctx.prisma.purchaseInvoice.findMany({
        where: {
          tenantId: ctx.tenant.id,
          isDeleted: false,
          status: "APPROVED",
          invoiceDate: { gte: input.from, lte: input.to },
        },
        select: { supplierName: true, supplierId: true, totalAmount: true, supplier: { select: { name: true } } },
      });

      const bySupplier = invoices.reduce(
        (acc, inv) => {
          const name = inv.supplier?.name ?? inv.supplierName ?? "غير محدد";
          acc[name] = (acc[name] ?? 0) + Number(inv.totalAmount ?? 0);
          return acc;
        },
        {} as Record<string, number>
      );

      return Object.entries(bySupplier)
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, input.limit);
    }),

  // WhatsApp-formatted daily summary
  whatsappDailySummary: tenantProcedure
    .input(z.object({ date: z.date().optional() }))
    .query(async ({ ctx, input }) => {
      const date = input.date ?? new Date();
      const from = startOfDay(date);
      const to = endOfDay(date);
      const tenantId = ctx.tenant.id;

      const restaurant = await ctx.prisma.restaurant.findUnique({
        where: { tenantId },
        select: { name: true, nameAr: true },
      });

      const [sales, expenses, invoices] = await Promise.all([
        ctx.prisma.salesTransaction.aggregate({
          where: { tenantId, transactedAt: { gte: from, lte: to } },
          _sum: { netAmount: true },
          _count: true,
        }),
        ctx.prisma.expense.aggregate({
          where: { tenantId, isDeleted: false, expenseDate: { gte: from, lte: to } },
          _sum: { amount: true },
        }),
        ctx.prisma.purchaseInvoice.aggregate({
          where: { tenantId, isDeleted: false, status: "APPROVED", invoiceDate: { gte: from, lte: to } },
          _sum: { totalAmount: true },
        }),
      ]);

      const totalSales = Number(sales._sum.netAmount ?? 0);
      const totalExpenses = Number(expenses._sum.amount ?? 0);
      const totalPurchases = Number(invoices._sum.totalAmount ?? 0);
      const totalCosts = totalExpenses + totalPurchases;
      const profit = totalSales - totalCosts;
      const margin = totalSales > 0 ? ((profit / totalSales) * 100).toFixed(1) : "0";
      const dateStr = format(date, "d/M/yyyy");
      const restaurantName = restaurant?.nameAr ?? restaurant?.name ?? "المطعم";

      const emoji = profit >= 0 ? "✅" : "⚠️";
      const arrow = profit >= 0 ? "📈" : "📉";

      const message = `🍽️ *${restaurantName}*
📅 تقرير يوم ${dateStr}
─────────────────
💰 *المبيعات:* ${totalSales.toLocaleString("ar-SA")} ر.س
   (${sales._count} طلب)

💸 *المصروفات:* ${totalExpenses.toLocaleString("ar-SA")} ر.س
🛒 *المشتريات:* ${totalPurchases.toLocaleString("ar-SA")} ر.س
─────────────────
${emoji} *صافي الربح: ${profit.toLocaleString("ar-SA")} ر.س*
${arrow} هامش الربح: ${margin}%
─────────────────
🤖 _مدار AI - المستشار المالي الذكي_`;

      return { message, stats: { totalSales, totalExpenses, totalPurchases, profit, margin } };
    }),
});
