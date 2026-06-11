"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
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

export default function ExpensesPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    category: "OTHER" as ExpenseCategory,
    description: "",
    amount: "",
    expenseDate: format(new Date(), "yyyy-MM-dd"),
  });

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.expenses.list.useQuery({ limit: 50 });
  const create = trpc.expenses.create.useMutation({
    onSuccess: () => {
      toast.success("تم إضافة المصروف");
      utils.expenses.list.invalidate();
      utils.financial.dailySummary.invalidate();
      setOpen(false);
      setForm({ category: "OTHER", description: "", amount: "", expenseDate: format(new Date(), "yyyy-MM-dd") });
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success("تم الحذف");
      utils.expenses.list.invalidate();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount))) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    create.mutate({
      category: form.category,
      description: form.description || undefined,
      amount: Number(form.amount),
      expenseDate: new Date(form.expenseDate),
    });
  }

  const totalToday = data?.items
    .filter((e) => format(new Date(e.expenseDate), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd"))
    .reduce((sum, e) => sum + Number(e.amount), 0) ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المصروفات</h1>
          <p className="text-muted-foreground text-sm">إجمالي اليوم: {formatSAR(totalToday)}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
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
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
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
              <Button type="submit" className="w-full" disabled={create.isPending}>
                {create.isPending ? "جاري الحفظ..." : "حفظ"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      )}

      <div className="space-y-2">
        {data?.items.map((expense) => (
          <Card key={expense.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="outline">{CATEGORIES[expense.category]}</Badge>
                <div>
                  <p className="text-sm font-medium">{expense.description || CATEGORIES[expense.category]}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(expense.expenseDate), "d MMMM yyyy", { locale: ar })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold">{formatSAR(Number(expense.amount))}</p>
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
        {!isLoading && data?.items.length === 0 && (
          <p className="text-center text-muted-foreground py-12">لا توجد مصروفات بعد</p>
        )}
      </div>
    </div>
  );
}
