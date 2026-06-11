import { z } from "zod";
import { createTRPCRouter, protectedProcedure, tenantProcedure } from "@/server/trpc/trpc";

export const profileRouter = createTRPCRouter({
  get: protectedProcedure.query(async ({ ctx }) => {
    return ctx.prisma.user.findUnique({
      where: { supabaseId: ctx.user.id },
      include: {
        tenants: {
          include: { tenant: { include: { restaurant: true } } },
        },
      },
    });
  }),

  update: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: { supabaseId: ctx.user.id },
        data: { name: input.name },
      });
    }),

  onboardingStatus: tenantProcedure.query(async ({ ctx }) => {
    const [restaurant, invoiceCount, expenseCount, foodicsStatus] = await Promise.all([
      ctx.prisma.restaurant.findUnique({
        where: { tenantId: ctx.tenant.id },
        select: { name: true, vatNumber: true, foodicsConnected: true },
      }),
      ctx.prisma.purchaseInvoice.count({ where: { tenantId: ctx.tenant.id } }),
      ctx.prisma.expense.count({ where: { tenantId: ctx.tenant.id } }),
      ctx.prisma.restaurant.findUnique({
        where: { tenantId: ctx.tenant.id },
        select: { foodicsConnected: true },
      }),
    ]);

    const steps = [
      { id: "profile", label: "إعداد بيانات المطعم", done: !!restaurant?.name },
      { id: "foodics", label: "ربط حساب Foodics", done: !!foodicsStatus?.foodicsConnected },
      { id: "invoice", label: "رفع أول فاتورة", done: invoiceCount > 0 },
      { id: "expense", label: "تسجيل أول مصروف", done: expenseCount > 0 },
    ];

    const completedCount = steps.filter((s) => s.done).length;
    const isComplete = completedCount === steps.length;
    const percentage = Math.round((completedCount / steps.length) * 100);

    return { steps, isComplete, percentage, completedCount, totalSteps: steps.length };
  }),
});
