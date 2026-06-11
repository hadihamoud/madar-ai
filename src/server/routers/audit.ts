import { z } from "zod";
import { createTRPCRouter, tenantProcedure } from "@/server/trpc/trpc";

export const auditRouter = createTRPCRouter({
  list: tenantProcedure
    .input(
      z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
        entity: z.string().optional(),
        action: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        tenantId: ctx.tenant.id,
        ...(input.entity && { entity: input.entity }),
        ...(input.action && { action: input.action }),
      };
      const [items, total] = await Promise.all([
        ctx.prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: input.limit,
          skip: input.offset,
          include: { user: { select: { name: true, email: true } } },
        }),
        ctx.prisma.auditLog.count({ where }),
      ]);
      return { items, total };
    }),
});
