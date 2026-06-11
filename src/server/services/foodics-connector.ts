import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";

const FOODICS_API_BASE = "https://api.foodics.com/api/v5";

type PrismaClient = typeof prisma;

export class FoodicsConnector {
  constructor(
    private readonly token: string,
    private readonly tenantId: string
  ) {}

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${FOODICS_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Foodics API error ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  async syncBranches(db: PrismaClient) {
    const data = await this.get<{ data: Array<{ id: string; name: string; name_ar?: string; city?: string }> }>("/branches");

    for (const branch of data.data) {
      await db.branch.upsert({
        where: {
          tenantId_foodicsId: { tenantId: this.tenantId, foodicsId: branch.id },
        },
        create: {
          tenantId: this.tenantId,
          foodicsId: branch.id,
          name: branch.name,
          nameAr: branch.name_ar,
          city: branch.city,
        },
        update: { name: branch.name, nameAr: branch.name_ar, city: branch.city },
      });
    }
  }

  async syncSales(db: PrismaClient) {
    const from = subDays(new Date(), 1);
    const data = await this.get<{
      data: Array<{
        id: string;
        reference: string;
        total_price: number;
        tax_amount: number;
        discount_amount: number;
        net_total: number;
        status: string;
        branch_id: string;
        created_at: string;
      }>;
    }>(`/orders?filters[created_at][gte]=${from.toISOString()}`);

    for (const order of data.data) {
      const branch = await db.branch.findFirst({
        where: { tenantId: this.tenantId, foodicsId: order.branch_id },
      });

      await db.salesTransaction.upsert({
        where: {
          tenantId_foodicsId: { tenantId: this.tenantId, foodicsId: order.id },
        },
        create: {
          tenantId: this.tenantId,
          foodicsId: order.id,
          branchId: branch?.id,
          orderNumber: order.reference,
          amount: order.total_price,
          tax: order.tax_amount,
          discount: order.discount_amount,
          netAmount: order.net_total,
          status: order.status,
          source: "foodics",
          transactedAt: new Date(order.created_at),
        },
        update: {
          amount: order.total_price,
          tax: order.tax_amount,
          discount: order.discount_amount,
          netAmount: order.net_total,
          status: order.status,
        },
      });
    }
  }

  async syncProducts(db: PrismaClient) {
    // Placeholder — Phase 2 consumption intelligence
    void db;
  }

  async syncCustomers(db: PrismaClient) {
    // Placeholder — future phases
    void db;
  }

  async syncOrders(db: PrismaClient) {
    return this.syncSales(db);
  }
}
