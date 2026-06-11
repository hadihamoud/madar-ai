import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc/trpc";

export const suppliersRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ activeOnly: z.boolean().default(true) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.supplier.findMany({
        where: { tenantId: ctx.tenant.id, ...(input.activeOnly && { isActive: true }) },
        orderBy: { name: "asc" },
        include: {
          _count: { select: { invoices: true } },
          invoices: {
            where: { isDeleted: false, status: "APPROVED" },
            select: { totalAmount: true, invoiceDate: true },
            orderBy: { invoiceDate: "desc" },
            take: 12,
          },
        },
      });
    }),

  getById: tenantProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.supplier.findFirst({
        where: { id: input.id, tenantId: ctx.tenant.id },
        include: {
          invoices: {
            where: { isDeleted: false },
            orderBy: { invoiceDate: "desc" },
            take: 20,
          },
        },
      });
    }),

  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().email().optional().or(z.literal("")),
        vatNumber: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = { ...input, email: input.email || undefined };
      return ctx.prisma.supplier.create({
        data: { tenantId: ctx.tenant.id, ...data },
      });
    }),

  update: tenantProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        vatNumber: z.string().optional(),
        notes: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.supplier.update({
        where: { id, tenantId: ctx.tenant.id },
        data,
      });
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.supplier.update({
        where: { id: input.id, tenantId: ctx.tenant.id },
        data: { isActive: false },
      });
    }),

  stats: tenantProcedure
    .input(z.object({ from: z.date(), to: z.date() }))
    .query(async ({ ctx, input }) => {
      const invoices = await ctx.prisma.purchaseInvoice.findMany({
        where: {
          tenantId: ctx.tenant.id,
          isDeleted: false,
          status: "APPROVED",
          invoiceDate: { gte: input.from, lte: input.to },
          supplierId: { not: null },
        },
        include: { supplier: { select: { name: true } } },
      });

      const bySupplier = invoices.reduce(
        (acc, inv) => {
          const name = inv.supplier?.name ?? inv.supplierName ?? "غير محدد";
          if (!acc[name]) acc[name] = { name, total: 0, count: 0 };
          acc[name].total += Number(inv.totalAmount ?? 0);
          acc[name].count += 1;
          return acc;
        },
        {} as Record<string, { name: string; total: number; count: number }>
      );

      return Object.values(bySupplier).sort((a, b) => b.total - a.total);
    }),
});
