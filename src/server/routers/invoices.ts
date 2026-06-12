import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc/trpc";

export const invoicesRouter = createTRPCRouter({
  list: tenantProcedure
    .input(
      z.object({
        status: z.enum(["PENDING","OCR_PROCESSING","OCR_COMPLETE","NEEDS_REVIEW","APPROVED","REJECTED"] as const).optional(),
        supplierId: z.string().optional(),
        from: z.date().optional(),
        to: z.date().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        tenantId: ctx.tenant.id,
        isDeleted: false,
        ...(input.status && { status: input.status }),
        ...(input.supplierId && { supplierId: input.supplierId }),
        ...(input.from || input.to
          ? {
              invoiceDate: {
                ...(input.from && { gte: input.from }),
                ...(input.to && { lte: input.to }),
              },
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        ctx.prisma.purchaseInvoice.findMany({
          where,
          include: { supplier: true, lineItems: true },
          orderBy: { createdAt: "desc" },
          take: input.limit,
          skip: input.offset,
        }),
        ctx.prisma.purchaseInvoice.count({ where }),
      ]);

      return { items, total };
    }),

  getById: tenantProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.purchaseInvoice.findFirst({
        where: { id: input.id, tenantId: ctx.tenant.id, isDeleted: false },
        include: { supplier: true, lineItems: true },
      });
    }),

  create: tenantProcedure
    .input(
      z.object({
        supplierName: z.string().optional(),
        supplierId: z.string().optional(),
        invoiceNumber: z.string().optional(),
        invoiceDate: z.date().optional(),
        amount: z.number().positive().optional(),
        vat: z.number().min(0).optional(),
        totalAmount: z.number().positive().optional(),
        currency: z.string().default("SAR"),
        category: z.string().optional(),
        fileUrl: z.string().optional(),
        fileName: z.string().optional(),
        fileType: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.purchaseInvoice.create({
        data: { tenantId: ctx.tenant.id, ...input, status: "PENDING" },
      });
    }),

  update: tenantProcedure
    .input(
      z.object({
        id: z.string(),
        supplierName: z.string().optional(),
        supplierId: z.string().optional(),
        invoiceNumber: z.string().optional(),
        invoiceDate: z.date().optional(),
        amount: z.number().positive().optional(),
        vat: z.number().min(0).optional(),
        totalAmount: z.number().positive().optional(),
        category: z.string().optional(),
        status: z.enum(["PENDING","OCR_PROCESSING","OCR_COMPLETE","NEEDS_REVIEW","APPROVED","REJECTED"]).optional(),
        notes: z.string().optional(),
        ocrOutput: z.record(z.string(), z.unknown()).optional(),
        ocrConfidence: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.prisma.purchaseInvoice.update({
        where: { id, tenantId: ctx.tenant.id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data as any,
      });
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.purchaseInvoice.update({
        where: { id: input.id, tenantId: ctx.tenant.id },
        data: { isDeleted: true },
      });
    }),

  markPaid: tenantProcedure
    .input(
      z.object({
        id: z.string(),
        isPaid: z.boolean(),
        paymentMethod: z.string().optional(),
        paidAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, isPaid, paymentMethod, paidAt } = input;
      return ctx.prisma.purchaseInvoice.update({
        where: { id, tenantId: ctx.tenant.id },
        data: {
          isPaid,
          paymentMethod: isPaid ? (paymentMethod ?? "cash") : null,
          paidAt: isPaid ? (paidAt ?? new Date()) : null,
        },
      });
    }),

  vatSummary: tenantProcedure
    .input(z.object({ from: z.date(), to: z.date() }))
    .query(async ({ ctx, input }) => {
      const [invoices, sales] = await Promise.all([
        ctx.prisma.purchaseInvoice.findMany({
          where: {
            tenantId: ctx.tenant.id,
            isDeleted: false,
            status: "APPROVED",
            invoiceDate: { gte: input.from, lte: input.to },
          },
          select: { vat: true, totalAmount: true, amount: true, supplierName: true, invoiceDate: true, invoiceNumber: true },
        }),
        ctx.prisma.salesTransaction.aggregate({
          where: { tenantId: ctx.tenant.id, transactedAt: { gte: input.from, lte: input.to } },
          _sum: { netAmount: true, tax: true },
        }),
      ]);

      const inputVat = invoices.reduce((s, i) => s + Number(i.vat ?? 0), 0); // VAT paid on purchases
      const outputVat = Number(sales._sum.tax ?? 0); // VAT collected on sales
      const netVatPayable = outputVat - inputVat;
      const totalPurchases = invoices.reduce((s, i) => s + Number(i.totalAmount ?? 0), 0);
      const totalSales = Number(sales._sum.netAmount ?? 0);

      return {
        inputVat: Math.round(inputVat * 100) / 100,
        outputVat: Math.round(outputVat * 100) / 100,
        netVatPayable: Math.round(netVatPayable * 100) / 100,
        totalPurchases: Math.round(totalPurchases * 100) / 100,
        totalSales: Math.round(totalSales * 100) / 100,
        invoiceCount: invoices.length,
        invoices: invoices.map((i) => ({
          supplierName: i.supplierName,
          invoiceDate: i.invoiceDate,
          invoiceNumber: i.invoiceNumber,
          amount: Number(i.amount ?? 0),
          vat: Number(i.vat ?? 0),
          totalAmount: Number(i.totalAmount ?? 0),
        })),
      };
    }),

  batchUpdate: tenantProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1),
        status: z.enum(["APPROVED", "REJECTED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.purchaseInvoice.updateMany({
        where: { id: { in: input.ids }, tenantId: ctx.tenant.id, isDeleted: false },
        data: { status: input.status },
      });
      return { updated: result.count };
    }),

  summary: tenantProcedure
    .input(z.object({ from: z.date(), to: z.date() }))
    .query(async ({ ctx, input }) => {
      const invoices = await ctx.prisma.purchaseInvoice.findMany({
        where: {
          tenantId: ctx.tenant.id,
          isDeleted: false,
          status: "APPROVED",
          invoiceDate: { gte: input.from, lte: input.to },
        },
      });

      const total = invoices.reduce((sum, i) => sum + Number(i.totalAmount ?? 0), 0);
      const byCategory = invoices.reduce(
        (acc, i) => {
          const cat = i.category ?? "Other";
          acc[cat] = (acc[cat] ?? 0) + Number(i.totalAmount ?? 0);
          return acc;
        },
        {} as Record<string, number>
      );

      return { total, byCategory, count: invoices.length };
    }),
});
