"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, AlertCircle, CheckCircle, TrendingDown } from "lucide-react";
import {
  startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter,
  subQuarters, format
} from "date-fns";
import { ar } from "date-fns/locale";

function formatSAR(n: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 2 }).format(n);
}

function exportVATCSV(data: ReturnType<typeof buildRows>, period: string) {
  const rows = [
    ["المورد", "تاريخ الفاتورة", "رقم الفاتورة", "المبلغ قبل الضريبة", "ضريبة المدخلات (15%)", "الإجمالي"],
    ...data.invoices.map((i) => [
      i.supplierName ?? "—",
      i.invoiceDate ? format(new Date(i.invoiceDate), "yyyy-MM-dd") : "—",
      i.invoiceNumber ?? "—",
      i.amount.toFixed(2),
      i.vat.toFixed(2),
      i.totalAmount.toFixed(2),
    ]),
    [],
    ["الإجمالي", "", "", data.totalPurchases.toFixed(2), data.inputVat.toFixed(2), ""],
    ["ضريبة المخرجات (مبيعات)", "", "", data.totalSales.toFixed(2), data.outputVat.toFixed(2), ""],
    ["صافي الضريبة المستحقة", "", "", "", data.netVatPayable.toFixed(2), ""],
  ];
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vat-report-${period.replace(/\s/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildRows(data: {
  inputVat: number; outputVat: number; netVatPayable: number;
  totalPurchases: number; totalSales: number; invoiceCount: number;
  invoices: Array<{ supplierName?: string | null; invoiceDate?: Date | null; invoiceNumber?: string | null; amount: number; vat: number; totalAmount: number }>;
}) {
  return data;
}

const PERIOD_OPTIONS = [
  { label: "هذا الشهر", getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: "الشهر الماضي", getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: "هذا الربع", getRange: () => ({ from: startOfQuarter(new Date()), to: endOfQuarter(new Date()) }) },
  { label: "الربع الماضي", getRange: () => ({ from: startOfQuarter(subQuarters(new Date(), 1)), to: endOfQuarter(subQuarters(new Date(), 1)) }) },
];

export default function VATPage() {
  const [periodIdx, setPeriodIdx] = useState(0);
  const period = PERIOD_OPTIONS[periodIdx];
  const { from, to } = period.getRange();

  const { data, isLoading } = trpc.invoices.vatSummary.useQuery({ from, to });

  const isRefund = (data?.netVatPayable ?? 0) < 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">تقرير ضريبة القيمة المضافة</h1>
          <p className="text-muted-foreground text-sm">
            ملخص ضريبة المدخلات والمخرجات — {period.label}
          </p>
        </div>
        {data && (
          <Button variant="outline" size="sm" onClick={() => exportVATCSV(data, period.label)}>
            <Download className="w-4 h-4 ml-1.5" />
            تصدير CSV
          </Button>
        )}
      </div>

      {/* Period selector */}
      <div className="flex gap-2 flex-wrap">
        {PERIOD_OPTIONS.map((p, i) => (
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

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : (
        <>
          {/* VAT summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border-red-500/20">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                  ضريبة المدخلات (مشتريات)
                </p>
                <p className="text-xl font-bold">{formatSAR(data?.inputVat ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">على {data?.invoiceCount ?? 0} فاتورة</p>
              </CardContent>
            </Card>
            <Card className="border-green-500/20">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  ضريبة المخرجات (مبيعات)
                </p>
                <p className="text-xl font-bold">{formatSAR(data?.outputVat ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">إجمالي مبيعات {formatSAR(data?.totalSales ?? 0)}</p>
              </CardContent>
            </Card>
            <Card className={isRefund ? "border-blue-500/20 bg-blue-500/5" : "border-orange-500/20 bg-orange-500/5"}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <AlertCircle className={`w-3.5 h-3.5 ${isRefund ? "text-blue-500" : "text-orange-500"}`} />
                  {isRefund ? "ضريبة مستردة" : "صافي الضريبة المستحقة"}
                </p>
                <p className={`text-xl font-bold ${isRefund ? "text-blue-600" : "text-orange-600"}`}>
                  {formatSAR(Math.abs(data?.netVatPayable ?? 0))}
                </p>
                <Badge variant="outline" className={`text-xs mt-1 ${isRefund ? "text-blue-600 border-blue-500/50" : "text-orange-600 border-orange-500/50"}`}>
                  {isRefund ? "استرداد من الهيئة" : "مستحق للهيئة"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* VAT calculation breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">حساب الضريبة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">إجمالي المبيعات</span>
                  <span>{formatSAR(data?.totalSales ?? 0)}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">ضريبة المخرجات (15% × مبيعات)</span>
                  <span className="text-green-600">+ {formatSAR(data?.outputVat ?? 0)}</span>
                </div>
                <div className="flex justify-between py-1.5 border-t">
                  <span className="text-muted-foreground">إجمالي المشتريات</span>
                  <span>{formatSAR(data?.totalPurchases ?? 0)}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-muted-foreground">ضريبة المدخلات (من الفواتير الموافق عليها)</span>
                  <span className="text-red-500">- {formatSAR(data?.inputVat ?? 0)}</span>
                </div>
                <div className="flex justify-between py-2 border-t font-semibold">
                  <span>{isRefund ? "مبلغ الاسترداد" : "صافي الضريبة المستحقة"}</span>
                  <span className={isRefund ? "text-blue-600" : "text-orange-600"}>
                    {formatSAR(Math.abs(data?.netVatPayable ?? 0))}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice detail table */}
          {data && data.invoices.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  فواتير المشتريات ({data.invoiceCount})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-muted-foreground text-xs">
                        <th className="text-right pb-2 font-medium">المورد</th>
                        <th className="text-right pb-2 font-medium">التاريخ</th>
                        <th className="text-left pb-2 font-medium">قبل الضريبة</th>
                        <th className="text-left pb-2 font-medium">الضريبة</th>
                        <th className="text-left pb-2 font-medium">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.invoices.map((inv, i) => (
                        <tr key={i} className="hover:bg-muted/50">
                          <td className="py-2 pr-0 pl-2 truncate max-w-[120px]">{inv.supplierName ?? "—"}</td>
                          <td className="py-2 text-muted-foreground text-xs">
                            {inv.invoiceDate ? format(new Date(inv.invoiceDate), "d MMM", { locale: ar }) : "—"}
                          </td>
                          <td className="py-2 text-left">{formatSAR(inv.amount)}</td>
                          <td className="py-2 text-left text-red-500">{formatSAR(inv.vat)}</td>
                          <td className="py-2 text-left font-medium">{formatSAR(inv.totalAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t font-semibold">
                      <tr>
                        <td colSpan={2} className="pt-2">المجموع</td>
                        <td className="pt-2 text-left">{formatSAR(data.totalPurchases)}</td>
                        <td className="pt-2 text-left text-red-500">{formatSAR(data.inputVat)}</td>
                        <td className="pt-2 text-left">{formatSAR(data.totalPurchases)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {data?.invoiceCount === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>لا توجد فواتير موافق عليها في هذه الفترة</p>
              <p className="text-sm mt-1">أضف فواتير شراء وافق عليها لظهورها هنا</p>
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">ملاحظة قانونية</p>
            <p>هذا التقرير تقديري للمساعدة في الإعداد لإقرار ضريبة القيمة المضافة. يرجى مراجعة محاسب معتمد قبل تقديم الإقرار الضريبي الرسمي لدى هيئة الزكاة والضريبة والجمارك.</p>
          </div>
        </>
      )}
    </div>
  );
}
