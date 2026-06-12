"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, TrendingUp, ShoppingBag, Zap, Download } from "lucide-react";
import { toast } from "sonner";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ar } from "date-fns/locale";
import { BranchSelector } from "@/components/dashboard/branch-selector";

function formatSAR(n: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);
}

function exportCSV(items: Array<{ transactedAt: Date | string; amount: string | number; discount: string | number; tax: string | number; netAmount: string | number; source: string; orderNumber?: string | null }>) {
  const rows = [
    ["التاريخ", "المبلغ", "الخصم", "الضريبة", "الصافي", "المصدر", "رقم الطلب"],
    ...items.map((t) => [
      format(new Date(t.transactedAt), "yyyy-MM-dd HH:mm"),
      Number(t.amount).toFixed(2),
      Number(t.discount).toFixed(2),
      Number(t.tax).toFixed(2),
      Number(t.netAmount).toFixed(2),
      t.source === "manual" ? "يدوي" : "Foodics",
      t.orderNumber ?? "",
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sales-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PERIOD_OPTIONS = [
  { label: "اليوم", days: 0 },
  { label: "أمس", days: 1 },
  { label: "7 أيام", days: 7 },
  { label: "30 يوم", days: 30 },
];

export default function SalesPage() {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState(0);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [form, setForm] = useState({
    amount: "",
    tax: "",
    discount: "",
    transactedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    orderNumber: "",
  });

  const utils = trpc.useUtils();

  const now = new Date();
  const from = period === 0 ? startOfDay(now) : startOfDay(subDays(now, period));
  const to = period === 1 ? endOfDay(subDays(now, 1)) : endOfDay(now);

  const { data: restaurant } = trpc.restaurant.get.useQuery(undefined, { refetchOnWindowFocus: false });

  const { data, isLoading } = trpc.sales.list.useQuery({
    from,
    to,
    ...(branchId ? { branchId } : {}),
    limit: 100,
  });

  const addSale = trpc.sales.addManual.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة المبيعة");
      utils.sales.list.invalidate();
      utils.financial.dailySummary.invalidate();
      setOpen(false);
      setForm({ amount: "", tax: "", discount: "", transactedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm"), orderNumber: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteSale = trpc.sales.deleteManual.useMutation({
    onSuccess: () => {
      toast.success("تم الحذف");
      utils.sales.list.invalidate();
      utils.financial.dailySummary.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) { toast.error("أدخل مبلغاً صحيحاً"); return; }
    addSale.mutate({
      amount,
      tax: Number(form.tax) || 0,
      discount: Number(form.discount) || 0,
      transactedAt: new Date(form.transactedAt),
      orderNumber: form.orderNumber || undefined,
      branchId: branchId ?? undefined,
    });
  }

  const totalSales = data?.items.reduce((s, t) => s + Number(t.netAmount), 0) ?? 0;
  const totalOrders = data?.total ?? 0;
  const avgOrder = totalOrders > 0 ? totalSales / totalOrders : 0;
  const manualCount = data?.items.filter((t) => t.source === "manual").length ?? 0;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">المبيعات</h1>
          <p className="text-muted-foreground text-sm">
            {manualCount > 0 && `${manualCount} إدخال يدوي · `}
            {totalOrders} عملية إجمالاً
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BranchSelector value={branchId} onChange={setBranchId} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(data?.items ?? [])}
            disabled={!data?.items.length}
          >
            <Download className="w-4 h-4 ml-1.5" />
            <span className="hidden sm:inline">تصدير</span>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>
              <Button size="sm">
                <Plus className="w-4 h-4 ml-1.5" />
                إضافة مبيعة
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>إدخال مبيعة يدوياً</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>المبلغ الإجمالي (ريال) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    dir="ltr"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>ضريبة القيمة المضافة (ريال)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      dir="ltr"
                      placeholder="0.00"
                      value={form.tax}
                      onChange={(e) => setForm((f) => ({ ...f, tax: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>الخصم (ريال)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      dir="ltr"
                      placeholder="0.00"
                      value={form.discount}
                      onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
                    />
                  </div>
                </div>
                {form.amount && (
                  <div className="bg-muted rounded-lg p-3 text-sm flex justify-between">
                    <span className="text-muted-foreground">الصافي بعد الخصم</span>
                    <span className="font-semibold">
                      {formatSAR(Math.max(0, Number(form.amount) - Number(form.discount || 0)))}
                    </span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>التاريخ والوقت *</Label>
                  <Input
                    type="datetime-local"
                    dir="ltr"
                    value={form.transactedAt}
                    onChange={(e) => setForm((f) => ({ ...f, transactedAt: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>رقم الطلب / الفاتورة (اختياري)</Label>
                  <Input
                    dir="ltr"
                    placeholder="INV-001"
                    value={form.orderNumber}
                    onChange={(e) => setForm((f) => ({ ...f, orderNumber: e.target.value }))}
                  />
                </div>
                {restaurant && restaurant.branches.length > 1 && (
                  <div className="space-y-2">
                    <Label>الفرع</Label>
                    <Select value={branchId ?? ""} onValueChange={(v) => setBranchId(v || null)}>
                      <SelectTrigger><SelectValue placeholder="اختر الفرع (اختياري)" /></SelectTrigger>
                      <SelectContent>
                        {restaurant.branches.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.nameAr || b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={addSale.isPending}>
                  {addSale.isPending ? "جاري الحفظ..." : "حفظ المبيعة"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex gap-2">
        {PERIOD_OPTIONS.map((p) => (
          <Button
            key={p.days}
            size="sm"
            variant={period === p.days ? "default" : "outline"}
            onClick={() => setPeriod(p.days)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <p className="text-xs text-muted-foreground">إجمالي المبيعات</p>
            </div>
            <p className="text-2xl font-bold">{formatSAR(totalSales)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingBag className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">عدد العمليات</p>
            </div>
            <p className="text-2xl font-bold">{totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-purple-500" />
              <p className="text-xs text-muted-foreground">متوسط الطلب</p>
            </div>
            <p className="text-2xl font-bold">{formatSAR(avgOrder)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction list */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
        </div>
      )}

      <div className="space-y-2">
        {data?.items.map((tx) => (
          <Card key={tx.id}>
            <CardContent className="p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{formatSAR(Number(tx.netAmount))}</p>
                    <Badge variant={tx.source === "manual" ? "outline" : "secondary"} className="text-xs">
                      {tx.source === "manual" ? "يدوي" : "Foodics"}
                    </Badge>
                    {tx.branch && (
                      <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                        {(tx.branch as { nameAr?: string; name: string }).nameAr || (tx.branch as { nameAr?: string; name: string }).name}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(tx.transactedAt), "d MMM yyyy، HH:mm", { locale: ar })}
                    {tx.orderNumber && ` · ${tx.orderNumber}`}
                    {Number(tx.discount) > 0 && ` · خصم ${formatSAR(Number(tx.discount))}`}
                  </p>
                </div>
              </div>
              {tx.source === "manual" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => deleteSale.mutate({ id: tx.id })}
                  disabled={deleteSale.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && data?.items.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>لا توجد مبيعات في هذه الفترة</p>
            <p className="text-sm mt-1">أضف مبيعة يدوياً أو اربط Foodics لاستيراد المبيعات تلقائياً</p>
          </div>
        )}
      </div>
    </div>
  );
}
