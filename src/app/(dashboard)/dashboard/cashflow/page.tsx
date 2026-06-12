"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart
} from "recharts";
import { TrendingUp, TrendingDown, Calendar, Info } from "lucide-react";

function formatSAR(n: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);
}

const HORIZON_OPTIONS = [
  { label: "7 أيام", days: 7 },
  { label: "14 يوم", days: 14 },
  { label: "30 يوم", days: 30 },
];

export default function CashFlowPage() {
  const [horizon, setHorizon] = useState(30);

  const { data, isLoading } = trpc.financial.cashFlowProjection.useQuery(
    { daysAhead: horizon },
    { refetchOnWindowFocus: false }
  );

  const trend = data?.trend ?? [];
  const chartData = trend.filter((_, i) => i % Math.ceil(trend.length / 20) === 0 || i === trend.length - 1);

  const isProfit = (data?.avgDailyProfit ?? 0) >= 0;

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border rounded-lg p-3 shadow text-sm" dir="rtl">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((p) => (
          <p key={p.name} className={p.value < 0 ? "text-red-500" : "text-green-500"}>
            {p.name}: {formatSAR(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">التدفق النقدي المتوقع</h1>
        <p className="text-muted-foreground text-sm">
          توقعات بناءً على متوسط آخر 30 يوم من المبيعات والمصروفات
        </p>
      </div>

      {/* Horizon selector */}
      <div className="flex gap-2">
        {HORIZON_OPTIONS.map((h) => (
          <Button
            key={h.days}
            size="sm"
            variant={horizon === h.days ? "default" : "outline"}
            onClick={() => setHorizon(h.days)}
          >
            {h.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* Assumptions row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "متوسط مبيعات يومي", value: data?.avgDailySales ?? 0, color: "text-blue-500" },
              { label: "متوسط تكاليف بضاعة", value: data?.avgDailyCogs ?? 0, color: "text-orange-500" },
              { label: "متوسط مصروفات تشغيل", value: data?.avgDailyOpex ?? 0, color: "text-yellow-500" },
              { label: "متوسط ربح يومي", value: data?.avgDailyProfit ?? 0, color: isProfit ? "text-green-500" : "text-red-500" },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`text-lg font-bold ${color}`}>{formatSAR(value)}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Projection summary */}
          <Card className={isProfit ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                {isProfit
                  ? <TrendingUp className="w-8 h-8 text-green-500 flex-shrink-0" />
                  : <TrendingDown className="w-8 h-8 text-red-500 flex-shrink-0" />
                }
                <div>
                  <p className="text-sm text-muted-foreground">الربح المتوقع خلال {horizon} يوماً القادمة</p>
                  <p className={`text-3xl font-bold ${isProfit ? "text-green-600" : "text-red-500"}`}>
                    {formatSAR(Math.round((data?.avgDailyProfit ?? 0) * horizon))}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    إجمالي مبيعات متوقعة: {formatSAR(Math.round((data?.avgDailySales ?? 0) * horizon))}
                  </p>
                </div>
                <Badge className={`mr-auto ${isProfit ? "bg-green-500" : "bg-red-500"}`}>
                  {isProfit ? "ربح" : "خسارة"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Cumulative profit chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                الربح التراكمي المتوقع
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <defs>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={isProfit ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={isProfit ? "#10b981" : "#ef4444"} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                  <Area
                    type="monotone"
                    dataKey="cumulativeProfit"
                    name="الربح التراكمي"
                    stroke={isProfit ? "#10b981" : "#ef4444"}
                    fill="url(#profitGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Daily projected sales vs costs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">المبيعات مقابل التكاليف اليومية المتوقعة</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dayLabel" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="projectedSales" name="المبيعات" stroke="#6366f1" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="projectedCosts" name="التكاليف" stroke="#f87171" strokeWidth={2} dot={false} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Disclaimer */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p>
              هذه التوقعات تقديرية بناءً على متوسط أداء آخر 30 يوم. لا تأخذ في الحسبان الموسمية، المواسم الخاصة، أو التغييرات في الأسعار.
              استخدمها كمؤشر توجيهي وليس كتنبؤ دقيق.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
