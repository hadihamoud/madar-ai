"use client";

import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Paperclip, ImageIcon, X, Download } from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ar } from "date-fns/locale";

type ExpenseCategory = "RENT" | "UTILITIES" | "FUEL" | "MAINTENANCE" | "CLEANING" | "MARKETING" | "SALARIES" | "OTHER";

const CATEGORIES: Record<ExpenseCategory, string> = {
  RENT: "إيجار",
  UTILITIES: "مرافق",
  FUEL: "وقود",
  MAINTENANCE: "صيانة",
  CLEANING: "نظافة",
  MARKETING: "تسويق",
  SALARIES: "رواتب",
  OTHER: "أخرى",
};

function formatSAR(amount: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount);
}

function exportCSV(items: Array<{ expenseDate: string | Date; category: string; description?: string | null; amount: string | number }>) {
  const rows = [
    ["التاريخ", "التصنيف", "الوصف", "المبلغ"],
    ...items.map((e) => [
      format(new Date(e.expenseDate), "yyyy-MM-dd"),
      CATEGORIES[e.category as ExpenseCategory] ?? e.category,
      e.description ?? "",
      Number(e.amount).toFixed(2),
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expenses-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExpensesPage() {
  const [open, setOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<ExpenseCategory | "ALL">("ALL");
  const [form, setForm] = useState({
    category: "OTHER" as ExpenseCategory,
    description: "",
    amount: "",
    expenseDate: format(new Date(), "yyyy-MM-dd"),
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.expenses.list.useQuery({ limit: 100 });
  const create = trpc.expenses.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة المصروف");
      utils.expenses.list.invalidate();
      utils.financial.dailySummary.invalidate();
      setOpen(false);
      resetForm();
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success("تم الحذف");
      utils.expenses.list.invalidate();
    },
  });

  function resetForm() {
    setForm({ category: "OTHER", description: "", amount: "", expenseDate: format(new Date(), "yyyy-MM-dd") });
    setReceiptFile(null);
    setReceiptPreview(null);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("الملف كبير جداً (الحد 5MB)"); return; }
    setReceiptFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setReceiptPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setReceiptPreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount))) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }

    let receiptUrl: string | undefined;

    if (receiptFile) {
      setUploadingReceipt(true);
      try {
        const fd = new FormData();
        fd.append("file", receiptFile);
        const res = await fetch("/api/upload/receipt", { method: "POST", body: fd });
        const json = await res.json() as { url?: string; error?: string };
        if (!res.ok) throw new Error(json.error ?? "Upload failed");
        receiptUrl = json.url;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "فشل رفع الإيصال");
        setUploadingReceipt(false);
        return;
      } finally {
        setUploadingReceipt(false);
      }
    }

    create.mutate({
      category: form.category,
      description: form.description || undefined,
      amount: Number(form.amount),
      expenseDate: new Date(form.expenseDate),
      receiptUrl,
    });
  }

  const filtered = data?.items.filter((e) =>
    filterCategory === "ALL" ? true : e.category === filterCategory
  ) ?? [];

  const totalFiltered = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const totalToday = data?.items
    .filter((e) => format(new Date(e.expenseDate), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"))
    .reduce((sum, e) => sum + Number(e.amount), 0) ?? 0;

  const byCategory = Object.entries(CATEGORIES).map(([k]) => ({
    key: k,
    label: CATEGORIES[k as ExpenseCategory],
    total: data?.items.filter((e) => e.category === k).reduce((s, e) => s + Number(e.amount), 0) ?? 0,
  })).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  const isPending = create.isPending || uploadingReceipt;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">المصروفات</h1>
          <p className="text-muted-foreground text-sm">اليوم: {formatSAR(totalToday)}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportCSV(data?.items ?? [])}
            disabled={!data?.items.length}
          >
            <Download className="w-4 h-4 ml-1.5" />
            <span className="hidden sm:inline">تصدير CSV</span>
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger>
              <Button>
                <Plus className="w-4 h-4 ml-2" />
                مصروف جديد
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة مصروف</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>التصنيف</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm((f) => ({ ...f, category: v as ExpenseCategory }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>الوصف (اختياري)</Label>
                  <Input
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="تفاصيل المصروف"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>المبلغ (ريال)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      placeholder="0.00"
                      dir="ltr"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>التاريخ</Label>
                    <Input
                      type="date"
                      value={form.expenseDate}
                      onChange={(e) => setForm((f) => ({ ...f, expenseDate: e.target.value }))}
                      dir="ltr"
                      required
                    />
                  </div>
                </div>

                {/* Receipt Upload */}
                <div className="space-y-2">
                  <Label>إيصال / وثيقة (اختياري)</Label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {receiptFile ? (
                    <div className="border rounded-lg p-3 flex items-center gap-3">
                      {receiptPreview ? (
                        <img src={receiptPreview} alt="preview" className="w-14 h-14 object-cover rounded" />
                      ) : (
                        <div className="w-14 h-14 bg-muted rounded flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{receiptFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(receiptFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-shrink-0"
                        onClick={() => { setReceiptFile(null); setReceiptPreview(null); if (fileRef.current) fileRef.current.value = ""; }}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Paperclip className="w-4 h-4 ml-2" />
                      إرفاق إيصال أو صورة
                    </Button>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={isPending}>
                  {uploadingReceipt ? "جاري رفع الإيصال..." : create.isPending ? "جاري الحفظ..." : "حفظ المصروف"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Category summary chips */}
      {byCategory.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategory("ALL")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${filterCategory === "ALL" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
          >
            الكل ({data?.items.length})
          </button>
          {byCategory.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilterCategory(c.key as ExpenseCategory)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${filterCategory === c.key ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}
            >
              {c.label} · {formatSAR(c.total)}
            </button>
          ))}
        </div>
      )}

      {/* Filter total */}
      {filterCategory !== "ALL" && (
        <p className="text-sm text-muted-foreground">
          إجمالي {CATEGORIES[filterCategory]}: <span className="font-semibold text-foreground">{formatSAR(totalFiltered)}</span>
        </p>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      )}

      {/* Expense list */}
      <div className="space-y-2">
        {filtered.map((expense) => (
          <Card key={expense.id}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Badge variant="outline" className="flex-shrink-0">{CATEGORIES[expense.category as ExpenseCategory]}</Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{expense.description || CATEGORIES[expense.category as ExpenseCategory]}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(expense.expenseDate), "d MMMM yyyy", { locale: ar })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {expense.receiptUrl && (
                  <a href={expense.receiptUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Paperclip className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                )}
                <p className="font-semibold text-sm w-24 text-left">{formatSAR(Number(expense.amount))}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                  onClick={() => deleteMutation.mutate({ id: expense.id })}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            {filterCategory === "ALL" ? "لا توجد مصروفات بعد" : `لا توجد مصروفات في فئة ${CATEGORIES[filterCategory]}`}
          </p>
        )}
      </div>
    </div>
  );
}
