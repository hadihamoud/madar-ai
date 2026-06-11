import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function createTRPCContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let dbUser = null;
  let tenant = null;

  if (user) {
    dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: {
        tenants: {
          include: { tenant: true },
          take: 1,
        },
      },
    });
    tenant = dbUser?.tenants[0]?.tenant ?? null;
  }

  return { user, dbUser, tenant, prisma };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.dbUser) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, user: ctx.user, dbUser: ctx.dbUser },
  });
});

export const tenantProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!ctx.tenant) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No tenant found" });
  }
  return next({
    ctx: { ...ctx, tenant: ctx.tenant },
  });
});
