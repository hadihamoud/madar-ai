"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Receipt, Lightbulb, AlertCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

function formatSAR(amount: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount);
}

export default function DashboardPage() {
  const today = new Date();
  const { data: summary, isLoading: summaryLoading } = trpc.financial.dailySummary.useQuery({ date: today });
  const { data: insights } = trpc.ai.listInsights.useQuery({ limit: 3 });
  const { data: recentInvoices } = trpc.invoices.list.useQuery({ limit: 3 });
  const { data: recentExpenses } = trpc.expenses.list.useQuery({ limit: 3 });

  const generateInsights = trpc.ai.generateInsights.useMutation();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm">
            {format(today, "EEEE، d MMMM yyyy", { locale: ar })}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => generateInsights.mutate()}
          disabled={generateInsights.isPending}
        >
          <Lightbulb className="w-4 h-4 ml-2" />
          {generateInsights.isPending ? "جاري التحليل..." : "تحديث التحليلات"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              المبيعات اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="h-8 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <p className="text-2xl font-bold">{formatSAR(summary?.totalSales ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">{summary?.orderCount ?? 0} طلب</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              المصروفات اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="h-8 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <p className="text-2xl font-bold">{formatSAR(summary?.totalCosts ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  فواتير + مصروفات
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={summary && summary.grossProfit >= 0 ? "border-green-500/30" : "border-red-500/30"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              الربح التقديري
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <div className="h-8 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <p className={`text-2xl font-bold ${(summary?.grossProfit ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatSAR(summary?.grossProfit ?? 0)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  هامش {summary?.profitMargin ?? 0}%
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      {insights && insights.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              تحليلات ذكية
            </h2>
            <Link href="/dashboard/insights">
              <Button variant="ghost" size="sm">عرض الكل</Button>
            </Link>
          </div>
          {insights.map((insight) => (
            <Card key={insight.id} className={
              insight.severity === "critical" ? "border-red-500/50" :
              insight.severity === "warning" ? "border-yellow-500/50" : ""
            }>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    insight.severity === "critical" ? "text-red-500" :
                    insight.severity === "warning" ? "text-yellow-500" : "text-blue-500"
                  }`} />
                  <div>
                    <p className="font-medium text-sm">{insight.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{insight.body}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              آخر الفواتير
            </h2>
            <Link href="/dashboard/invoices">
              <Button variant="ghost" size="sm">عرض الكل</Button>
            </Link>
          </div>
          {recentInvoices?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد فواتير بعد</p>
          )}
          {recentInvoices?.items.map((inv) => (
            <Card key={inv.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{inv.supplierName ?? "مورد غير محدد"}</p>
                  <p className="text-xs text-muted-foreground">
                    {inv.invoiceDate ? format(new Date(inv.invoiceDate), "d MMM", { locale: ar }) : "—"}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold">{formatSAR(Number(inv.totalAmount ?? 0))}</p>
                  <Badge variant="secondary" className="text-xs">
                    {inv.status === "APPROVED" ? "موافق" :
                     inv.status === "PENDING" ? "معلق" :
                     inv.status === "OCR_COMPLETE" ? "يحتاج مراجعة" : inv.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              آخر المصروفات
            </h2>
            <Link href="/dashboard/expenses">
              <Button variant="ghost" size="sm">عرض الكل</Button>
            </Link>
          </div>
          {recentExpenses?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">لا توجد مصروفات بعد</p>
          )}
          {recentExpenses?.items.map((exp) => (
            <Card key={exp.id}>
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{exp.description ?? exp.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(exp.expenseDate), "d MMM", { locale: ar })}
                  </p>
                </div>
                <p className="text-sm font-semibold">{formatSAR(Number(exp.amount))}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
