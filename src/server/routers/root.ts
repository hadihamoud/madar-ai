import { createTRPCRouter } from "@/server/trpc/trpc";
import { authRouter } from "./auth";
import { restaurantRouter } from "./restaurant";
import { expensesRouter } from "./expenses";
import { invoicesRouter } from "./invoices";
import { financialRouter } from "./financial";
import { aiRouter } from "./ai";
import { foodicsRouter } from "./foodics";
import { suppliersRouter } from "./suppliers";
import { notificationsRouter } from "./notifications";
import { reportsRouter } from "./reports";
import { profileRouter } from "./profile";
import { auditRouter } from "./audit";
import { salesRouter } from "./sales";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  restaurant: restaurantRouter,
  expenses: expensesRouter,
  invoices: invoicesRouter,
  financial: financialRouter,
  ai: aiRouter,
  foodics: foodicsRouter,
  suppliers: suppliersRouter,
  notifications: notificationsRouter,
  reports: reportsRouter,
  profile: profileRouter,
  audit: auditRouter,
  sales: salesRouter,
});

export type AppRouter = typeof appRouter;
