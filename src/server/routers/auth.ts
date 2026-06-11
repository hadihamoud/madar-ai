import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/trpc/trpc";
import { prisma } from "@/lib/prisma";

export const authRouter = createTRPCRouter({
  syncUser: protectedProcedure.mutation(async ({ ctx }) => {
    const { user } = ctx;
    const email = user.email!;
    const name = user.user_metadata?.full_name ?? email.split("@")[0];

    const dbUser = await prisma.user.upsert({
      where: { supabaseId: user.id },
      create: {
        supabaseId: user.id,
        email,
        name,
        avatarUrl: user.user_metadata?.avatar_url,
      },
      update: { email, name, avatarUrl: user.user_metadata?.avatar_url },
    });

    const existing = await prisma.userTenant.findFirst({
      where: { userId: dbUser.id },
      include: { tenant: true },
    });

    if (!existing) {
      const slug = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-");
      const tenant = await prisma.tenant.create({
        data: {
          name,
          slug: `${slug}-${Date.now()}`,
          users: { create: { userId: dbUser.id, role: "OWNER" } },
        },
      });
      return { user: dbUser, tenant };
    }

    return { user: dbUser, tenant: existing.tenant };
  }),

  me: protectedProcedure.query(async ({ ctx }) => {
    return prisma.user.findUnique({
      where: { supabaseId: ctx.user.id },
      include: {
        tenants: { include: { tenant: { include: { restaurant: true } } } },
      },
    });
  }),
});
