"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Receipt, Lightbulb, AlertCircle, ChevronLeft, BarChart3,
  MessageSquare, CheckCircle, ArrowUp, ArrowDown
} from "lucide-react";
import Link from "next/link";
import { format, subDays, startOfMonth } from "date-fns";
import { ar } from "date-fns/locale";

function formatSAR(amount: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(amount);
}

export default function DashboardPage() {
  const today = new Date();
  const yesterday = subDays(today, 1);
  const monthStart = startOfMonth(today);

  const { data: todaySummary, isLoading } = trpc.financial.dailySummary.useQuery({ date: today });
  const { data: yesterdaySummary } = trpc.financial.dailySummary.useQuery({ date: yesterday });
  const { data: monthlySummary } = trpc.financial.monthlySummary.useQuery({ month: today });
  const { data: insights } = trpc.ai.listInsights.useQuery({ limit: 3, unreadOnly: false });
  const { data: recentInvoices } = trpc.invoices.list.useQuery({ limit: 4 });
  const { data: recentExpenses } = trpc.expenses.list.useQuery({ limit: 4 });
  const { data: onboarding } = trpc.profile.onboardingStatus.useQuery();
  const generateInsights = trpc.ai.generateInsights.useMutation();

  // Calculate day-over-day change
  function pctChange(today: number, yesterday: number) {
    if (!yesterday) return null;
    return ((today - yesterday) / yesterday) * 100;
  }

  const salesChange = todaySummary && yesterdaySummary
    ? pctChange(todaySummary.totalSales, yesterdaySummary.totalSales)
    : null;
  const profitChange = todaySummary && yesterdaySummary
    ? pctChange(todaySummary.grossProfit, yesterdaySummary.grossProfit)
    : null;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm">
            {format(today, "EEEE، d MMMM yyyy", { locale: ar })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => generateInsights.mutate()} disabled={generateInsights.isPending}>
          <Lightbulb className="w-4 h-4 ml-1.5" />
          <span className="hidden sm:inline">{generateInsights.isPending ? "جاري..." : "تحديث التحليلات"}</span>
        </Button>
      </div>

      {/* Onboarding prompt */}
      {onboarding && !onboarding.isComplete && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <p className="font-medium text-sm mb-1">أكمل إعداد حسابك ({onboarding.percentage}%)</p>
                <Progress value={onboarding.percentage} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1">
                  {onboarding.steps.find(s => !s.done)?.label}
                </p>
              </div>
              <Link href="/onboarding">
                <Button size="sm">إكمال الإعداد</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Sales */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5" />
              مبيعات اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="h-8 bg-muted animate-pulse rounded" /> : (
              <>
                <p className="text-2xl font-bold">{formatSAR(todaySummary?.totalSales ?? 0)}</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">{todaySummary?.orderCount ?? 0} طلب</p>
                  {salesChange !== null && (
                    <span className={`text-xs flex items-center gap-0.5 ${salesChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {salesChange >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      {Math.abs(salesChange).toFixed(1)}%
                    </span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Costs */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TrendingDown className="w-3.5 h-3.5" />
              تكاليف اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="h-8 bg-muted animate-pulse rounded" /> : (
              <>
                <p className="text-2xl font-bold">{formatSAR(todaySummary?.totalCosts ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">مصروفات + مشتريات</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Profit */}
        <Card className={(todaySummary?.grossProfit ?? 0) >= 0 ? "border-green-500/30" : "border-red-500/30"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              الربح التقديري
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <div className="h-8 bg-muted animate-pulse rounded" /> : (
              <>
                <p className={`text-2xl font-bold ${(todaySummary?.grossProfit ?? 0) >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatSAR(todaySummary?.grossProfit ?? 0)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">هامش {todaySummary?.profitMargin ?? 0}%</p>
                  {profitChange !== null && (
                    <span className={`text-xs flex items-center gap-0.5 ${profitChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {profitChange >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                      {Math.abs(profitChange).toFixed(1)}%
                    </span>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Monthly snapshot */}
      {monthlySummary && (
        <Card className="bg-gradient-to-l from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-medium text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                ملخص {format(today, "MMMM", { locale: ar })}
              </p>
              <Link href="/dashboard/reports">
                <Button variant="ghost" size="sm" className="text-xs h-7">عرض التقارير <ChevronLeft className="w-3 h-3 mr-1" /></Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
              {[
                { label: "المبيعات", value: monthlySummary.totalSales },
                { label: "التكاليف", value: monthlySummary.totalCosts },
                { label: "الربح", value: monthlySummary.grossProfit },
                { label: "الهامش", value: null, pct: monthlySummary.profitMargin },
              ].map(({ label, value, pct }) => (
                <div key={label} className="bg-background/60 rounded-lg p-2">
                  <p className="text-muted-foreground text-xs">{label}</p>
                  <p className="font-bold text-sm mt-0.5">
                    {pct !== undefined ? `${pct}%` : formatSAR(value ?? 0)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Insights */}
      {insights && insights.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-primary" />
              تحليلات ذكية
            </h2>
            <Link href="/dashboard/insights">
              <Button variant="ghost" size="sm" className="text-xs h-7">الكل <ChevronLeft className="w-3 h-3 mr-1" /></Button>
            </Link>
          </div>
          {insights.slice(0, 2).map(insight => (
            <Card key={insight.id} className={
              insight.severity === "critical" ? "border-red-500/40" :
              insight.severity === "warning" ? "border-yellow-500/40" : ""
            }>
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    insight.severity === "critical" ? "text-red-500" :
                    insight.severity === "warning" ? "text-yellow-500" : "text-blue-500"
                  }`} />
                  <div>
                    <p className="font-medium text-sm">{insight.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{insight.body}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/dashboard/invoices", label: "رفع فاتورة", icon: ShoppingCart },
          { href: "/dashboard/expenses", label: "مصروف جديد", icon: Receipt },
          { href: "/dashboard/reports", label: "التقارير", icon: BarChart3 },
          { href: "/dashboard/assistant", label: "اسأل AI", icon: MessageSquare },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
                <Icon className="w-5 h-5 text-primary" />
                <p className="text-xs font-medium">{label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent invoices */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              آخر الفواتير
            </h2>
            <Link href="/dashboard/invoices">
              <Button variant="ghost" size="sm" className="text-xs h-7">الكل <ChevronLeft className="w-3 h-3 mr-1" /></Button>
            </Link>
          </div>
          {recentInvoices?.items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد فواتير بعد</p>
          )}
          {recentInvoices?.items.map(inv => (
            <div key={inv.id} className="flex items-center justify-between py-2 border-b border-muted last:border-0">
              <div>
                <p className="text-sm font-medium">{inv.supplierName ?? "مورد غير محدد"}</p>
                <p className="text-xs text-muted-foreground">
                  {inv.invoiceDate ? format(new Date(inv.invoiceDate), "d MMM", { locale: ar }) : "—"}
                </p>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">{formatSAR(Number(inv.totalAmount ?? 0))}</p>
                <Badge variant={inv.status === "APPROVED" ? "default" : "secondary"} className="text-xs">
                  {inv.status === "APPROVED" ? "موافق" : inv.status === "PENDING" ? "معلق" : "مراجعة"}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        {/* Recent expenses */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              آخر المصروفات
            </h2>
            <Link href="/dashboard/expenses">
              <Button variant="ghost" size="sm" className="text-xs h-7">الكل <ChevronLeft className="w-3 h-3 mr-1" /></Button>
            </Link>
          </div>
          {recentExpenses?.items.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">لا توجد مصروفات بعد</p>
          )}
          {recentExpenses?.items.map(exp => (
            <div key={exp.id} className="flex items-center justify-between py-2 border-b border-muted last:border-0">
              <div>
                <p className="text-sm font-medium">{exp.description ?? exp.category}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(exp.expenseDate), "d MMM", { locale: ar })}
                </p>
              </div>
              <p className="text-sm font-semibold">{formatSAR(Number(exp.amount))}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
