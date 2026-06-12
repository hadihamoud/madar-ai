import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc/trpc";
import { startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, format, addDays } from "date-fns";

export const financialRouter = createTRPCRouter({
  dailySummary: tenantProcedure
    .input(z.object({ date: z.date().optional(), branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const date = input.date ?? new Date();
      const from = startOfDay(date);
      const to = endOfDay(date);
      const tenantId = ctx.tenant.id;
      const branchFilter = input.branchId ? { branchId: input.branchId } : {};

      const [sales, expenses, invoices] = await Promise.all([
        ctx.prisma.salesTransaction.aggregate({
          where: { tenantId, ...branchFilter, transactedAt: { gte: from, lte: to } },
          _sum: { netAmount: true },
          _count: true,
        }),
        ctx.prisma.expense.aggregate({
          where: { tenantId, isDeleted: false, expenseDate: { gte: from, lte: to } },
          _sum: { amount: true },
        }),
        ctx.prisma.purchaseInvoice.aggregate({
          where: {
            tenantId,
            isDeleted: false,
            status: "APPROVED",
            invoiceDate: { gte: from, lte: to },
          },
          _sum: { totalAmount: true },
        }),
      ]);

      const totalSales = Number(sales._sum.netAmount ?? 0);
      const totalExpenses = Number(expenses._sum.amount ?? 0);
      const totalPurchases = Number(invoices._sum.totalAmount ?? 0);
      const totalCosts = totalExpenses + totalPurchases;
      const grossProfit = totalSales - totalCosts;
      const profitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

      return {
        date,
        totalSales,
        totalExpenses,
        totalPurchases,
        totalCosts,
        grossProfit,
        profitMargin: Math.round(profitMargin * 10) / 10,
        orderCount: sales._count,
      };
    }),

  monthlySummary: tenantProcedure
    .input(z.object({ month: z.date().optional(), branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const month = input.month ?? new Date();
      const from = startOfMonth(month);
      const to = endOfMonth(month);
      const tenantId = ctx.tenant.id;
      const branchFilter = input.branchId ? { branchId: input.branchId } : {};

      const [sales, expenses, invoices] = await Promise.all([
        ctx.prisma.salesTransaction.aggregate({
          where: { tenantId, ...branchFilter, transactedAt: { gte: from, lte: to } },
          _sum: { netAmount: true },
          _count: true,
        }),
        ctx.prisma.expense.aggregate({
          where: { tenantId, isDeleted: false, expenseDate: { gte: from, lte: to } },
          _sum: { amount: true },
        }),
        ctx.prisma.purchaseInvoice.aggregate({
          where: {
            tenantId,
            isDeleted: false,
            status: "APPROVED",
            invoiceDate: { gte: from, lte: to },
          },
          _sum: { totalAmount: true },
        }),
      ]);

      const totalSales = Number(sales._sum.netAmount ?? 0);
      const totalExpenses = Number(expenses._sum.amount ?? 0);
      const totalPurchases = Number(invoices._sum.totalAmount ?? 0);
      const totalCosts = totalExpenses + totalPurchases;
      const grossProfit = totalSales - totalCosts;
      const profitMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

      return {
        month,
        totalSales,
        totalExpenses,
        totalPurchases,
        totalCosts,
        grossProfit,
        profitMargin: Math.round(profitMargin * 10) / 10,
        orderCount: sales._count,
      };
    }),

  cashFlowProjection: tenantProcedure
    .input(z.object({ daysAhead: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      const today = new Date();
      const last30From = startOfDay(subDays(today, 30));
      const last30To = endOfDay(subDays(today, 1));

      // Historical averages from last 30 days
      const [salesAgg, expenseAgg, invoiceAgg] = await Promise.all([
        ctx.prisma.salesTransaction.aggregate({
          where: { tenantId: ctx.tenant.id, transactedAt: { gte: last30From, lte: last30To } },
          _sum: { netAmount: true },
          _count: true,
        }),
        ctx.prisma.expense.aggregate({
          where: { tenantId: ctx.tenant.id, isDeleted: false, expenseDate: { gte: last30From, lte: last30To } },
          _sum: { amount: true },
        }),
        ctx.prisma.purchaseInvoice.aggregate({
          where: {
            tenantId: ctx.tenant.id,
            isDeleted: false,
            status: "APPROVED",
            invoiceDate: { gte: last30From, lte: last30To },
          },
          _sum: { totalAmount: true },
        }),
      ]);

      const avgDailySales = Number(salesAgg._sum.netAmount ?? 0) / 30;
      const avgDailyCogs = Number(invoiceAgg._sum.totalAmount ?? 0) / 30;
      const avgDailyOpex = Number(expenseAgg._sum.amount ?? 0) / 30;
      const avgDailyProfit = avgDailySales - avgDailyCogs - avgDailyOpex;

      // Project forward
      const projected = Array.from({ length: input.daysAhead }, (_, i) => {
        const date = addDays(today, i + 1);
        const cumulative = avgDailyProfit * (i + 1);
        return {
          date: format(date, "yyyy-MM-dd"),
          dayLabel: format(date, "d/M"),
          projectedSales: Math.round(avgDailySales),
          projectedCosts: Math.round(avgDailyCogs + avgDailyOpex),
          projectedProfit: Math.round(avgDailyProfit),
          cumulativeProfit: Math.round(cumulative),
        };
      });

      return {
        avgDailySales: Math.round(avgDailySales),
        avgDailyCogs: Math.round(avgDailyCogs),
        avgDailyOpex: Math.round(avgDailyOpex),
        avgDailyProfit: Math.round(avgDailyProfit),
        projected30dayProfit: Math.round(avgDailyProfit * 30),
        projectedMonthSales: Math.round(avgDailySales * 30),
        breakEvenDays: avgDailyProfit > 0 ? null : -1,
        trend: projected,
        basedOnDays: 30,
      };
    }),

  branchComparison: tenantProcedure
    .input(z.object({ from: z.date(), to: z.date() }))
    .query(async ({ ctx, input }) => {
      const branches = await ctx.prisma.branch.findMany({
        where: { tenantId: ctx.tenant.id, isActive: true },
        include: {
          salesTransactions: {
            where: { transactedAt: { gte: input.from, lte: input.to } },
          },
        },
      });

      return branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        totalSales: branch.salesTransactions.reduce(
          (sum, t) => sum + Number(t.netAmount),
          0
        ),
        orderCount: branch.salesTransactions.length,
      }));
    }),
});
