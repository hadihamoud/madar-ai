import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FoodicsConnector } from "@/server/services/foodics-connector";

// Called by Vercel Cron every 15 minutes
// Config in vercel.json
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const restaurants = await prisma.restaurant.findMany({
    where: { foodicsConnected: true, foodicsToken: { not: null } },
    select: { tenantId: true, foodicsToken: true, id: true },
  });

  const results: Array<{ tenantId: string; status: string; error?: string }> = [];

  for (const restaurant of restaurants) {
    try {
      const connector = new FoodicsConnector(restaurant.foodicsToken!, restaurant.tenantId);
      await connector.syncBranches(prisma);
      await connector.syncSales(prisma);
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: { lastSyncAt: new Date() },
      });
      results.push({ tenantId: restaurant.tenantId, status: "ok" });
    } catch (err) {
      results.push({
        tenantId: restaurant.tenantId,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ synced: results.length, results });
}
