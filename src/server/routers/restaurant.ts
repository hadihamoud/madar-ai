import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc/trpc";

export const restaurantRouter = createTRPCRouter({
  get: tenantProcedure.query(async ({ ctx }) => {
    return ctx.prisma.restaurant.findUnique({
      where: { tenantId: ctx.tenant.id },
      include: { branches: true },
    });
  }),

  setTargets: tenantProcedure
    .input(
      z.object({
        monthlyRevenueTarget: z.number().positive().optional(),
        monthlyProfitTarget: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.restaurant.update({
        where: { tenantId: ctx.tenant.id },
        data: {
          monthlyRevenueTarget: input.monthlyRevenueTarget,
          monthlyProfitTarget: input.monthlyProfitTarget,
        },
      });
    }),

  upsert: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1),
        nameAr: z.string().optional(),
        crNumber: z.string().optional(),
        vatNumber: z.string().optional(),
        city: z.string().optional(),
        timezone: z.string().default("Asia/Riyadh"),
        currency: z.string().default("SAR"),
        monthlyRevenueTarget: z.number().positive().optional(),
        monthlyProfitTarget: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.restaurant.upsert({
        where: { tenantId: ctx.tenant.id },
        create: { tenantId: ctx.tenant.id, ...input },
        update: input,
      });
    }),
});
