import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc/trpc";

export const salesRouter = createTRPCRouter({
  list: tenantProcedure
    .input(
      z.object({
        from: z.date().optional(),
        to: z.date().optional(),
        branchId: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        tenantId: ctx.tenant.id,
        ...(input.branchId && { branchId: input.branchId }),
        ...(input.from || input.to
          ? { transactedAt: { ...(input.from && { gte: input.from }), ...(input.to && { lte: input.to }) } }
          : {}),
      };
      const [items, total] = await Promise.all([
        ctx.prisma.salesTransaction.findMany({
          where,
          orderBy: { transactedAt: "desc" },
          take: input.limit,
          skip: input.offset,
          include: { branch: { select: { id: true, name: true, nameAr: true } } },
        }),
        ctx.prisma.salesTransaction.count({ where }),
      ]);
      return { items, total };
    }),

  addManual: tenantProcedure
    .input(
      z.object({
        amount: z.number().positive(),
        tax: z.number().min(0).default(0),
        discount: z.number().min(0).default(0),
        transactedAt: z.date(),
        branchId: z.string().optional(),
        orderNumber: z.string().optional(),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const netAmount = input.amount - input.discount;
      const tx = await ctx.prisma.salesTransaction.create({
        data: {
          tenantId: ctx.tenant.id,
          branchId: input.branchId ?? null,
          amount: input.amount,
          tax: input.tax,
          discount: input.discount,
          netAmount,
          status: "completed",
          source: "manual",
          transactedAt: input.transactedAt,
          orderNumber: input.orderNumber ?? null,
        },
      });
      await ctx.prisma.auditLog.create({
        data: {
          tenantId: ctx.tenant.id,
          userId: ctx.dbUser.id,
          action: "CREATE",
          entity: "SalesTransaction",
          entityId: tx.id,
          after: { ...tx, source: "manual" } as object,
        },
      });
      return tx;
    }),

  deleteManual: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Only allow deleting manual entries
      const tx = await ctx.prisma.salesTransaction.findFirst({
        where: { id: input.id, tenantId: ctx.tenant.id, source: "manual" },
      });
      if (!tx) throw new Error("لا يمكن حذف هذا السجل");
      await ctx.prisma.salesTransaction.delete({ where: { id: input.id } });
      return { ok: true };
    }),

  dailyTotals: tenantProcedure
    .input(z.object({ from: z.date(), to: z.date(), branchId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const transactions = await ctx.prisma.salesTransaction.findMany({
        where: {
          tenantId: ctx.tenant.id,
          ...(input.branchId && { branchId: input.branchId }),
          transactedAt: { gte: input.from, lte: input.to },
        },
        select: { transactedAt: true, netAmount: true, source: true },
        orderBy: { transactedAt: "asc" },
      });

      // Group by date
      const byDate = new Map<string, { sales: number; count: number }>();
      for (const t of transactions) {
        const key = t.transactedAt.toISOString().slice(0, 10);
        const existing = byDate.get(key) ?? { sales: 0, count: 0 };
        byDate.set(key, { sales: existing.sales + Number(t.netAmount), count: existing.count + 1 });
      }

      return Array.from(byDate.entries()).map(([date, v]) => ({
        date,
        ...v,
      }));
    }),
});
