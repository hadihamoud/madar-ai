import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc/trpc";

export const restaurantRouter = createTRPCRouter({
  get: tenantProcedure.query(async ({ ctx }) => {
    return ctx.prisma.restaurant.findUnique({
      where: { tenantId: ctx.tenant.id },
      include: { branches: true },
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
