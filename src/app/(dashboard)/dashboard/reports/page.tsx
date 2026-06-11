"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from "recharts";
import { subDays, startOfMonth, endOfMonth, format } from "date-fns";
import { ar } from "date-fns/locale";
import { Copy, Check, TrendingUp, TrendingDown, DollarSign, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

function formatSAR(n: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);
}

const CATEGORY_LABELS: Record<string, string> = {
  RENT: "إيجار", UTILITIES: "مرافق", FUEL: "وقود",
  MAINTENANCE: "صيانة", CLEANING: "نظافة", MARKETING: "تسويق",
  SALARIES: "رواتب", OTHER: "أخرى",
};

const PIE_COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];

export default function ReportsPage() {
  const [period, setPeriod] = useState<"7d" | "30d" | "month">("30d");
  const [copied, setCopied] = useState(false);

  const now = new Date();
  const from = period === "7d" ? subDays(now, 7) : period === "30d" ? subDays(now, 30) : startOfMonth(now);
  const to = period === "month" ? endOfMonth(now) : now;

  const { data: daily, isLoading: dailyLoading } = trpc.reports.dailyBreakdown.useQuery({ from, to });
  const { data: expCat } = trpc.reports.expenseByCategory.useQuery({ from, to });
  const { data: topSup } = trpc.reports.topSuppliers.useQuery({ from, to, limit: 5 });
  const { data: whatsapp } = trpc.reports.whatsappDailySummary.useQuery({ date: now });
  const { data: monthly } = trpc.financial.monthlySummary.useQuery({ month: now });

  async function copyWhatsApp() {
    if (!whatsapp?.message) return;
    await navigator.clipboard.writeText(whatsapp.message);
    setCopied(true);
    toast.success("تم نسخ التقرير");
    setTimeout(() => setCopied(false), 2000);
  }

  const totalSales = daily?.reduce((s, d) => s + d.sales, 0) ?? 0;
  const totalCosts = daily?.reduce((s, d) => s + d.costs, 0) ?? 0;
  const totalProfit = totalSales - totalCosts;
  const avgDailySales = daily?.length ? totalSales / daily.length : 0;

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border rounded-lg p-3 shadow text-sm" dir="rtl">
        <p className="font-medium mb-1">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }}>{p.name}: {formatSAR(p.value)}</p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">التقارير</h1>
        <div className="flex gap-2">
          {(["7d", "30d", "month"] as const).map(p => (
            <Button key={p} variant={period === p ? "default" : "outline"} size="sm" onClick={() => setPeriod(p)}>
              {p === "7d" ? "7 أيام" : p === "30d" ? "30 يوم" : "هذا الشهر"}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "إجمالي المبيعات", value: totalSales, icon: DollarSign, color: "text-blue-500" },
          { label: "إجمالي التكاليف", value: totalCosts, icon: ShoppingCart, color: "text-orange-500" },
          { label: "صافي الربح", value: totalProfit, icon: totalProfit >= 0 ? TrendingUp : TrendingDown, color: totalProfit >= 0 ? "text-green-500" : "text-red-500" },
          { label: "متوسط المبيعات اليومي", value: avgDailySales, icon: TrendingUp, color: "text-purple-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${color}`} />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
              <p className={`text-xl font-bold ${label === "صافي الربح" ? color : ""}`}>{formatSAR(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="sales">المبيعات</TabsTrigger>
          <TabsTrigger value="profit">الأرباح</TabsTrigger>
          <TabsTrigger value="expenses">المصروفات</TabsTrigger>
          <TabsTrigger value="suppliers">الموردون</TabsTrigger>
          <TabsTrigger value="whatsapp">تقرير واتساب</TabsTrigger>
        </TabsList>

        {/* Sales Chart */}
        <TabsContent value="sales" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">المبيعات اليومية</CardTitle></CardHeader>
            <CardContent>
              {dailyLoading ? <div className="h-64 bg-muted animate-pulse rounded" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={daily} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="sales" name="المبيعات" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="costs" name="التكاليف" fill="#f87171" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profit Chart */}
        <TabsContent value="profit" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">صافي الربح اليومي</CardTitle></CardHeader>
            <CardContent>
              {dailyLoading ? <div className="h-64 bg-muted animate-pulse rounded" /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={daily} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="profit" name="الربح" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses by Category */}
        <TabsContent value="expenses" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">المصروفات حسب الفئة</CardTitle></CardHeader>
              <CardContent>
                {!expCat ? <div className="h-48 bg-muted animate-pulse rounded" /> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={expCat} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={(props) => `${(props as { percentage?: number }).percentage ?? 0}%`}>
                        {expCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => typeof v === "number" ? formatSAR(v) : v} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">تفاصيل المصروفات</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {expCat?.map((e, i) => (
                  <div key={e.category} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-sm flex-1">{CATEGORY_LABELS[e.category] ?? e.category}</span>
                    <span className="text-sm font-medium">{formatSAR(e.amount)}</span>
                    <Badge variant="outline" className="text-xs w-12 justify-center">{e.percentage}%</Badge>
                  </div>
                ))}
                {!expCat?.length && <p className="text-muted-foreground text-sm text-center py-4">لا توجد مصروفات في هذه الفترة</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Top Suppliers */}
        <TabsContent value="suppliers" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">أكبر الموردين إنفاقاً</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {topSup?.map((s, i) => {
                const pct = topSup[0]?.total ? (s.total / topSup[0].total) * 100 : 0;
                return (
                  <div key={s.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground w-4">#{i + 1}</span>
                        <span className="font-medium">{s.name}</span>
                      </span>
                      <span className="font-semibold">{formatSAR(s.total)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              {!topSup?.length && <p className="text-muted-foreground text-sm text-center py-4">لا توجد فواتير موافق عليها في هذه الفترة</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp Report */}
        <TabsContent value="whatsapp" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">تقرير واتساب اليومي</CardTitle>
                <Button size="sm" variant="outline" onClick={copyWhatsApp}>
                  {copied ? <Check className="w-4 h-4 ml-2 text-green-500" /> : <Copy className="w-4 h-4 ml-2" />}
                  {copied ? "تم النسخ" : "نسخ"}
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm bg-muted rounded-xl p-4 leading-relaxed font-sans text-right" dir="rtl">
                  {whatsapp?.message ?? "جاري تحميل التقرير..."}
                </pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">ملخص الشهر الحالي</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {monthly && (
                  <>
                    {[
                      { label: "إجمالي المبيعات", value: monthly.totalSales, positive: true },
                      { label: "مصروفات تشغيل", value: monthly.totalExpenses },
                      { label: "مشتريات", value: monthly.totalPurchases },
                      { label: "صافي الربح", value: monthly.grossProfit, highlight: true },
                    ].map(({ label, value, highlight }) => (
                      <div key={label} className={`flex justify-between items-center py-2 ${highlight ? "border-t font-bold" : ""}`}>
                        <span className={highlight ? "text-foreground" : "text-muted-foreground text-sm"}>{label}</span>
                        <span className={highlight ? (value >= 0 ? "text-green-500" : "text-red-500") : ""}>{formatSAR(value)}</span>
                      </div>
                    ))}
                    <div className="bg-muted rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">هامش الربح</p>
                      <p className="text-2xl font-bold">{monthly.profitMargin}%</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
