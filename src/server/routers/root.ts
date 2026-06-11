import { createTRPCRouter } from "@/server/trpc/trpc";
import { authRouter } from "./auth";
import { restaurantRouter } from "./restaurant";
import { expensesRouter } from "./expenses";
import { invoicesRouter } from "./invoices";
import { financialRouter } from "./financial";
import { aiRouter } from "./ai";
import { foodicsRouter } from "./foodics";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  restaurant: restaurantRouter,
  expenses: expensesRouter,
  invoices: invoicesRouter,
  financial: financialRouter,
  ai: aiRouter,
  foodics: foodicsRouter,
});

export type AppRouter = typeof appRouter;
