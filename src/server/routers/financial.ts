import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc/trpc";
import { startOfDay, endOfDay, startOfMonth, endOfMonth } from "date-fns";

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
