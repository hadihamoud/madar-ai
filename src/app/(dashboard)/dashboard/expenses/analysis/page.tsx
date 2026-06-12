"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from "recharts";
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ar } from "date-fns/locale";

function formatSAR(n: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);
}

const CATEGORY_LABELS: Record<string, string> = {
  RENT: "إيجار", UTILITIES: "مرافق", FUEL: "وقود",
  MAINTENANCE: "صيانة", CLEANING: "نظافة", MARKETING: "تسويق",
  SALARIES: "رواتب", OTHER: "أخرى",
};

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];

function pctChange(curr: number, prev: number) {
  if (!prev) return null;
  return ((curr - prev) / prev) * 100;
}

export default function ExpenseAnalysisPage() {
  const now = new Date();
  const m0From = startOfMonth(now);
  const m0To = endOfMonth(now);
  const m1From = startOfMonth(subMonths(now, 1));
  const m1To = endOfMonth(subMonths(now, 1));
  const m2From = startOfMonth(subMonths(now, 2));
  const m2To = endOfMonth(subMonths(now, 2));

  const { data: curr } = trpc.expenses.summary.useQuery({ from: m0From, to: m0To });
  const { data: prev } = trpc.expenses.summary.useQuery({ from: m1From, to: m1To });
  const { data: prev2 } = trpc.expenses.summary.useQuery({ from: m2From, to: m2To });

  const months = [
    { label: format(subMonths(now, 2), "MMM", { locale: ar }), data: prev2 },
    { label: format(subMonths(now, 1), "MMM", { locale: ar }), data: prev },
    { label: format(now, "MMM", { locale: ar }), data: curr },
  ];

  // Build category comparison data for chart
  const allCategories = new Set([
    ...Object.keys(curr?.byCategory ?? {}),
    ...Object.keys(prev?.byCategory ?? {}),
    ...Object.keys(prev2?.byCategory ?? {}),
  ]);

  const chartData = Array.from(allCategories).map((cat) => ({
    category: CATEGORY_LABELS[cat] ?? cat,
    [format(subMonths(now, 2), "MMM", { locale: ar })]: prev2?.byCategory[cat] ?? 0,
    [format(subMonths(now, 1), "MMM", { locale: ar })]: prev?.byCategory[cat] ?? 0,
    [format(now, "MMM", { locale: ar })]: curr?.byCategory[cat] ?? 0,
  }));

  // Alerts: categories that increased >20% vs last month
  const alerts = Array.from(allCategories)
    .map((cat) => {
      const c = curr?.byCategory[cat] ?? 0;
      const p = prev?.byCategory[cat] ?? 0;
      const change = pctChange(c, p);
      return { cat, label: CATEGORY_LABELS[cat] ?? cat, curr: c, prev: p, change };
    })
    .filter((a) => a.change !== null && a.change > 20 && a.curr > 0)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0));

  const totalChange = pctChange(curr?.total ?? 0, prev?.total ?? 0);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">تحليل المصروفات</h1>
        <p className="text-muted-foreground text-sm">مقارنة شهرية للمصروفات حسب الفئة</p>
      </div>

      {/* Month totals */}
      <div className="grid grid-cols-3 gap-3">
        {months.map(({ label, data }, i) => {
          const isCurrentMonth = i === 2;
          const change = i === 2 ? pctChange(curr?.total ?? 0, prev?.total ?? 0)
                       : i === 1 ? pctChange(prev?.total ?? 0, prev2?.total ?? 0)
                       : null;
          return (
            <Card key={label} className={isCurrentMonth ? "border-primary/50" : ""}>
              <CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                  {label}
                  {isCurrentMonth && <Badge variant="outline" className="text-[10px] h-4 px-1">الحالي</Badge>}
                </p>
                <p className="text-lg font-bold">{formatSAR(data?.total ?? 0)}</p>
                {change !== null && (
                  <p className={`text-xs mt-0.5 flex items-center justify-center gap-0.5 ${change > 0 ? "text-red-500" : "text-green-500"}`}>
                    {change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                    {Math.abs(change).toFixed(1)}%
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              تنبيهات ارتفاع المصروفات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a) => (
              <div key={a.cat} className="flex items-center justify-between text-sm">
                <span>{a.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-xs">{formatSAR(a.prev)} ← {formatSAR(a.curr)}</span>
                  <Badge variant="outline" className="text-red-500 border-red-500/50 text-xs">
                    <TrendingUp className="w-3 h-3 ml-1" />
                    +{a.change?.toFixed(0)}%
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Category comparison chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">المصروفات حسب الفئة — مقارنة 3 أشهر</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 30, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  angle={-30}
                  textAnchor="end"
                  interval={0}
                />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => formatSAR(v)}
                  contentStyle={{ direction: "rtl", fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                {months.map(({ label }, i) => (
                  <Bar key={label} dataKey={label} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Category breakdown table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">تفصيل المصروفات — {format(now, "MMMM yyyy", { locale: ar })}</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.entries(curr?.byCategory ?? {}).length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-4">لا توجد مصروفات هذا الشهر</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(curr?.byCategory ?? {})
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([cat, amount], i) => {
                  const prevAmount = prev?.byCategory[cat] ?? 0;
                  const change = pctChange(amount as number, prevAmount);
                  const pctOfTotal = curr?.total ? ((amount as number) / curr.total) * 100 : 0;
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                          {CATEGORY_LABELS[cat] ?? cat}
                        </span>
                        <div className="flex items-center gap-3">
                          {change !== null && (
                            <span className={`text-xs ${change > 0 ? "text-red-500" : "text-green-500"}`}>
                              {change > 0 ? "+" : ""}{change.toFixed(0)}%
                            </span>
                          )}
                          <span className="font-medium w-24 text-left">{formatSAR(amount as number)}</span>
                          <span className="text-xs text-muted-foreground w-10 text-left">{pctOfTotal.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pctOfTotal}%`, background: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
