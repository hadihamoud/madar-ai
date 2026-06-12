"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronLeft } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear } from "date-fns";
import { ar } from "date-fns/locale";

function formatSAR(n: number, showSign = false) {
  const fmt = new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(Math.abs(n));
  if (showSign && n < 0) return `(${fmt})`;
  return fmt;
}

function pct(part: number, total: number) {
  if (!total) return "0.0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

const EXPENSE_LABELS: Record<string, string> = {
  RENT: "إيجار", UTILITIES: "مرافق", FUEL: "وقود",
  MAINTENANCE: "صيانة", CLEANING: "نظافة", MARKETING: "تسويق",
  SALARIES: "رواتب", OTHER: "مصروفات أخرى",
};

type Period = { label: string; from: Date; to: Date };

function getPeriods(): Period[] {
  const now = new Date();
  return [
    { label: format(now, "MMMM yyyy", { locale: ar }), from: startOfMonth(now), to: endOfMonth(now) },
    { label: format(subMonths(now, 1), "MMMM yyyy", { locale: ar }), from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) },
    { label: format(subMonths(now, 2), "MMMM yyyy", { locale: ar }), from: startOfMonth(subMonths(now, 2)), to: endOfMonth(subMonths(now, 2)) },
    { label: `سنة ${format(now, "yyyy")}`, from: startOfYear(now), to: endOfYear(now) },
  ];
}

function exportPnL(rows: Array<{ label: string; amount: number; type: string }>, period: string) {
  const data = [
    ["البند", "المبلغ (ريال)", "النوع"],
    ...rows.map((r) => [r.label, r.amount.toFixed(2), r.type]),
  ];
  const csv = "﻿" + data.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pnl-${period.replace(/\s/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

type SectionProps = { title: string; amount: number; pctOf?: number; children?: React.ReactNode; highlight?: boolean; negative?: boolean };

function PnLRow({ label, amount, pctOf, indent = 0, muted = false }: { label: string; amount: number; pctOf?: number; indent?: number; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${indent ? "pr-" + (indent * 4) : ""}`} style={{ paddingRight: indent * 16 }}>
      <span className={`text-sm ${muted ? "text-muted-foreground" : ""}`}>{label}</span>
      <div className="flex items-center gap-4">
        {pctOf !== undefined && (
          <span className="text-xs text-muted-foreground w-12 text-left">{pct(amount, pctOf)}</span>
        )}
        <span className={`text-sm font-medium w-28 text-left ${amount < 0 ? "text-red-500" : ""}`}>
          {amount < 0 ? `(${formatSAR(Math.abs(amount))})` : formatSAR(amount)}
        </span>
      </div>
    </div>
  );
}

function Divider({ label, amount, pctOf, positive }: { label: string; amount: number; pctOf?: number; positive?: boolean }) {
  const isGood = positive ? amount >= 0 : amount <= 0;
  return (
    <div className={`flex items-center justify-between py-2 border-t border-b font-semibold my-1 ${amount >= 0 ? "" : "text-red-500"}`}>
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-4">
        {pctOf !== undefined && (
          <span className="text-xs text-muted-foreground w-12 text-left">{pct(amount, pctOf)}</span>
        )}
        <span className={`text-sm w-28 text-left ${amount < 0 ? "text-red-500" : amount > 0 ? "text-green-600" : ""}`}>
          {amount < 0 ? `(${formatSAR(Math.abs(amount))})` : formatSAR(amount)}
        </span>
      </div>
    </div>
  );
}

export default function PnLPage() {
  const periods = getPeriods();
  const [periodIdx, setPeriodIdx] = useState(0);
  const period = periods[periodIdx];

  const { data: monthly } = trpc.financial.monthlySummary.useQuery({ month: period.from });
  const { data: expSummary } = trpc.expenses.summary.useQuery({ from: period.from, to: period.to });
  const { data: invSummary } = trpc.invoices.summary.useQuery({ from: period.from, to: period.to });

  const revenue = monthly?.totalSales ?? 0;
  const cogs = Number(invSummary?.total ?? 0); // purchase invoices = COGS
  const grossProfit = revenue - cogs;

  const opex = monthly?.totalExpenses ?? 0; // operating expenses
  const ebitda = grossProfit - opex;

  const expByCategory = expSummary?.byCategory ?? {};

  function buildExportRows() {
    const rows = [
      { label: "إجمالي المبيعات", amount: revenue, type: "إيرادات" },
      { label: "تكلفة البضاعة المباعة (مشتريات)", amount: -cogs, type: "تكاليف مباشرة" },
      { label: "مجمل الربح", amount: grossProfit, type: "إجمالي" },
      ...Object.entries(expByCategory).map(([k, v]) => ({
        label: EXPENSE_LABELS[k] ?? k,
        amount: -(v as number),
        type: "مصروفات تشغيل",
      })),
      { label: "صافي الربح التشغيلي", amount: ebitda, type: "إجمالي" },
    ];
    return rows;
  }

  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const netMargin = revenue > 0 ? (ebitda / revenue) * 100 : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">قائمة الدخل (P&L)</h1>
          <p className="text-muted-foreground text-sm">بيان الأرباح والخسائر</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPnL(buildExportRows(), period.label)}
          >
            <Download className="w-4 h-4 ml-1.5" />
            تصدير CSV
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-2 flex-wrap">
        {periods.map((p, i) => (
          <Button
            key={i}
            size="sm"
            variant={periodIdx === i ? "default" : "outline"}
            onClick={() => setPeriodIdx(i)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* Margin KPI chips */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">المبيعات</p>
            <p className="text-lg font-bold">{formatSAR(revenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">هامش المجمل</p>
            <p className={`text-lg font-bold ${grossMargin >= 0 ? "text-green-600" : "text-red-500"}`}>
              {grossMargin.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">هامش الصافي</p>
            <p className={`text-lg font-bold ${netMargin >= 0 ? "text-green-600" : "text-red-500"}`}>
              {netMargin.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* P&L Statement */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>قائمة الدخل — {period.label}</span>
            <span className="text-xs font-normal text-muted-foreground">% من المبيعات</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Revenue */}
          <div className="mb-2">
            <p className="text-xs text-muted-foreground font-semibold mb-1 pt-2">الإيرادات</p>
            <PnLRow label="إجمالي المبيعات" amount={revenue} pctOf={revenue} />
          </div>

          <Divider label="إجمالي الإيرادات" amount={revenue} pctOf={revenue} positive />

          {/* COGS */}
          <div className="my-2">
            <p className="text-xs text-muted-foreground font-semibold mb-1 pt-2">تكلفة البضاعة المباعة</p>
            <PnLRow label="مشتريات (فواتير موافق عليها)" amount={cogs} pctOf={revenue} muted />
          </div>

          <Divider label="مجمل الربح" amount={grossProfit} pctOf={revenue} positive />

          {/* Operating Expenses */}
          <div className="my-2">
            <p className="text-xs text-muted-foreground font-semibold mb-1 pt-2">مصروفات التشغيل</p>
            {Object.entries(expByCategory).length > 0 ? (
              Object.entries(expByCategory).map(([cat, val]) => (
                <PnLRow
                  key={cat}
                  label={EXPENSE_LABELS[cat] ?? cat}
                  amount={val as number}
                  pctOf={revenue}
                  indent={1}
                  muted
                />
              ))
            ) : (
              <p className="text-xs text-muted-foreground py-2 pr-4">لا توجد مصروفات مسجلة في هذه الفترة</p>
            )}
            <PnLRow label="إجمالي مصروفات التشغيل" amount={opex} pctOf={revenue} />
          </div>

          <Divider label="صافي الربح التشغيلي (EBITDA)" amount={ebitda} pctOf={revenue} positive />

          {/* Bottom line */}
          <div className={`mt-4 p-4 rounded-xl text-center ${ebitda >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
            <p className="text-xs text-muted-foreground mb-1">الربح / الخسارة الصافية</p>
            <p className={`text-3xl font-bold ${ebitda >= 0 ? "text-green-600" : "text-red-500"}`}>
              {ebitda < 0 ? `(${formatSAR(Math.abs(ebitda))})` : formatSAR(ebitda)}
            </p>
            <p className="text-sm text-muted-foreground mt-1">هامش {netMargin.toFixed(1)}%</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              {ebitda >= 0
                ? <Badge className="bg-green-500"><TrendingUp className="w-3 h-3 ml-1" />ربح</Badge>
                : <Badge variant="destructive"><TrendingDown className="w-3 h-3 ml-1" />خسارة</Badge>
              }
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        * يعتمد هذا البيان على المبيعات المسجلة من Foodics أو الإدخال اليدوي، والفواتير الموافق عليها، والمصروفات المدخلة
      </p>
    </div>
  );
}
