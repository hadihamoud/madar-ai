import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc/trpc";
import { FoodicsConnector } from "@/server/services/foodics-connector";

export const foodicsRouter = createTRPCRouter({
  getStatus: tenantProcedure.query(async ({ ctx }) => {
    const restaurant = await ctx.prisma.restaurant.findUnique({
      where: { tenantId: ctx.tenant.id },
      select: { foodicsConnected: true, lastSyncAt: true, foodicsAccountId: true },
    });
    return restaurant ?? { foodicsConnected: false, lastSyncAt: null, foodicsAccountId: null };
  }),

  disconnect: tenantProcedure.mutation(async ({ ctx }) => {
    return ctx.prisma.restaurant.update({
      where: { tenantId: ctx.tenant.id },
      data: { foodicsConnected: false, foodicsToken: null, foodicsAccountId: null },
    });
  }),

  triggerSync: tenantProcedure
    .input(z.object({ type: z.enum(["sales", "branches", "products", "all"]).default("all") }))
    .mutation(async ({ ctx, input }) => {
      const restaurant = await ctx.prisma.restaurant.findUnique({
        where: { tenantId: ctx.tenant.id },
        select: { foodicsToken: true, foodicsConnected: true },
      });

      if (!restaurant?.foodicsConnected || !restaurant?.foodicsToken) {
        throw new Error("Foodics is not connected");
      }

      const connector = new FoodicsConnector(restaurant.foodicsToken, ctx.tenant.id);

      if (input.type === "all" || input.type === "branches") {
        await connector.syncBranches(ctx.prisma);
      }
      if (input.type === "all" || input.type === "sales") {
        await connector.syncSales(ctx.prisma);
      }

      await ctx.prisma.restaurant.update({
        where: { tenantId: ctx.tenant.id },
        data: { lastSyncAt: new Date() },
      });

      return { success: true, syncedAt: new Date() };
    }),
});
