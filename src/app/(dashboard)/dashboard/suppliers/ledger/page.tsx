"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Search, AlertCircle, CheckCircle, Phone } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import Link from "next/link";

function formatSAR(n: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);
}

function exportCSV(rows: Array<{ name: string; invoiceCount: number; totalInvoiced: number; totalPaid: number; outstanding: number; lastInvoiceDate: Date | null }>) {
  const data = [
    ["المورد", "عدد الفواتير", "إجمالي المستحق", "المدفوع", "المتبقي", "آخر فاتورة"],
    ...rows.map((r) => [
      r.name,
      String(r.invoiceCount),
      r.totalInvoiced.toFixed(2),
      r.totalPaid.toFixed(2),
      r.outstanding.toFixed(2),
      r.lastInvoiceDate ? format(new Date(r.lastInvoiceDate), "yyyy-MM-dd") : "—",
    ]),
  ];
  const csv = "﻿" + data.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `supplier-ledger-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SupplierLedgerPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "outstanding" | "settled">("all");

  const { data, isLoading } = trpc.suppliers.ledger.useQuery();

  const filtered = (data ?? []).filter((s) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ? true :
      filter === "outstanding" ? s.outstanding > 0 :
      s.outstanding === 0;
    return matchSearch && matchFilter;
  });

  const totalOutstanding = (data ?? []).reduce((s, r) => s + r.outstanding, 0);
  const totalInvoiced = (data ?? []).reduce((s, r) => s + r.totalInvoiced, 0);
  const totalPaid = (data ?? []).reduce((s, r) => s + r.totalPaid, 0);
  const suppliersWithBalance = (data ?? []).filter((s) => s.outstanding > 0).length;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">دفتر الموردين</h1>
          <p className="text-muted-foreground text-sm">
            {suppliersWithBalance} موردين لديهم أرصدة مستحقة
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(filtered.map((s) => ({ ...s, lastInvoiceDate: s.lastInvoiceDate ? new Date(s.lastInvoiceDate) : null })))}
            disabled={!filtered.length}
          >
            <Download className="w-4 h-4 ml-1.5" />
            تصدير
          </Button>
          <Link href="/dashboard/suppliers">
            <Button variant="outline" size="sm">إدارة الموردين</Button>
          </Link>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">إجمالي المستحق</p>
            <p className="text-lg font-bold">{formatSAR(totalInvoiced)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">المدفوع</p>
            <p className="text-lg font-bold text-green-600">{formatSAR(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">الرصيد المتبقي</p>
            <p className="text-lg font-bold text-orange-600">{formatSAR(totalOutstanding)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pr-9"
            placeholder="ابحث باسم المورد..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "outstanding", "settled"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
            >
              {f === "all" ? "الكل" : f === "outstanding" ? "لديه رصيد" : "مسوّى"}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((supplier) => (
            <Card key={supplier.id} className={supplier.outstanding > 0 ? "border-orange-500/20" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">{supplier.name}</p>
                      {!supplier.isActive && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">غير نشط</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>{supplier.invoiceCount} فاتورة</span>
                      {supplier.lastInvoiceDate && (
                        <span>آخر فاتورة: {format(new Date(supplier.lastInvoiceDate), "d MMM yyyy", { locale: ar })}</span>
                      )}
                      {supplier.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {supplier.phone}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0 text-sm">
                    <div className="text-center hidden sm:block">
                      <p className="text-xs text-muted-foreground">المستحق</p>
                      <p className="font-medium">{formatSAR(supplier.totalInvoiced)}</p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="text-xs text-muted-foreground">المدفوع</p>
                      <p className="font-medium text-green-600">{formatSAR(supplier.totalPaid)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">الرصيد</p>
                      <p className={`font-bold ${supplier.outstanding > 0 ? "text-orange-600" : "text-green-600"}`}>
                        {formatSAR(supplier.outstanding)}
                      </p>
                    </div>
                    {supplier.outstanding > 0
                      ? <AlertCircle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                      : <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    }
                  </div>
                </div>

                {/* Balance bar */}
                {supplier.totalInvoiced > 0 && (
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, (supplier.totalPaid / supplier.totalInvoiced) * 100)}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {!isLoading && filtered.length === 0 && (
            <p className="text-center text-muted-foreground py-12">
              {data?.length === 0 ? "لا يوجد موردون بعد" : "لا توجد نتائج مطابقة"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
