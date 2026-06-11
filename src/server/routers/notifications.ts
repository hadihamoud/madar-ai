import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc/trpc";

export const notificationsRouter = createTRPCRouter({
  list: tenantProcedure
    .input(z.object({ limit: z.number().default(20), unreadOnly: z.boolean().default(false) }))
    .query(async ({ ctx, input }) => {
      return ctx.prisma.notification.findMany({
        where: {
          tenantId: ctx.tenant.id,
          ...(input.unreadOnly && { isRead: false }),
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  unreadCount: tenantProcedure.query(async ({ ctx }) => {
    return ctx.prisma.notification.count({
      where: { tenantId: ctx.tenant.id, isRead: false },
    });
  }),

  markRead: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.notification.update({
        where: { id: input.id, tenantId: ctx.tenant.id },
        data: { isRead: true },
      });
    }),

  markAllRead: tenantProcedure.mutation(async ({ ctx }) => {
    return ctx.prisma.notification.updateMany({
      where: { tenantId: ctx.tenant.id, isRead: false },
      data: { isRead: true },
    });
  }),

  create: tenantProcedure
    .input(
      z.object({
        title: z.string(),
        body: z.string(),
        type: z.enum(["info", "warning", "success", "error"]).default("info"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.notification.create({
        data: { tenantId: ctx.tenant.id, ...input },
      });
    }),
});
