"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, TrendingUp, Receipt, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type Mode = "sale" | "expense";

type ExpenseCategory = "RENT" | "UTILITIES" | "FUEL" | "MAINTENANCE" | "CLEANING" | "MARKETING" | "SALARIES" | "OTHER";

const CATEGORIES: Record<ExpenseCategory, string> = {
  RENT: "إيجار", UTILITIES: "مرافق", FUEL: "وقود",
  MAINTENANCE: "صيانة", CLEANING: "نظافة", MARKETING: "تسويق",
  SALARIES: "رواتب", OTHER: "أخرى",
};

export function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("sale");
  const [menuOpen, setMenuOpen] = useState(false);

  const [saleForm, setSaleForm] = useState({ amount: "", discount: "" });
  const [expForm, setExpForm] = useState({
    amount: "",
    category: "OTHER" as ExpenseCategory,
    description: "",
  });

  const utils = trpc.useUtils();

  const addSale = trpc.sales.addManual.useMutation({
    onSuccess: () => {
      toast.success("✅ تم إضافة المبيعة");
      utils.financial.dailySummary.invalidate();
      utils.sales.list.invalidate();
      setOpen(false);
      setSaleForm({ amount: "", discount: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const addExpense = trpc.expenses.create.useMutation({
    onSuccess: () => {
      toast.success("✅ تم إضافة المصروف");
      utils.financial.dailySummary.invalidate();
      utils.expenses.list.invalidate();
      setOpen(false);
      setExpForm({ amount: "", category: "OTHER", description: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  function openAs(m: Mode) {
    setMode(m);
    setMenuOpen(false);
    setOpen(true);
  }

  function handleSaleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(saleForm.amount);
    if (!amount) { toast.error("أدخل المبلغ"); return; }
    addSale.mutate({
      amount,
      discount: Number(saleForm.discount) || 0,
      transactedAt: new Date(),
    });
  }

  function handleExpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(expForm.amount);
    if (!amount) { toast.error("أدخل المبلغ"); return; }
    addExpense.mutate({
      amount,
      category: expForm.category,
      description: expForm.description || undefined,
      expenseDate: new Date(),
    });
  }

  return (
    <>
      {/* FAB */}
      <div className="fixed bottom-6 left-6 z-40 flex flex-col items-end gap-2">
        {menuOpen && (
          <>
            <button
              onClick={() => openAs("sale")}
              className="flex items-center gap-2 bg-green-500 text-white rounded-full px-4 py-2.5 shadow-lg text-sm font-medium hover:bg-green-600 transition-colors"
            >
              <TrendingUp className="w-4 h-4" />
              إضافة مبيعة
            </button>
            <button
              onClick={() => openAs("expense")}
              className="flex items-center gap-2 bg-orange-500 text-white rounded-full px-4 py-2.5 shadow-lg text-sm font-medium hover:bg-orange-600 transition-colors"
            >
              <Receipt className="w-4 h-4" />
              إضافة مصروف
            </button>
          </>
        )}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={cn(
            "w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all",
            menuOpen ? "bg-muted-foreground rotate-45" : "bg-primary"
          )}
        >
          {menuOpen
            ? <X className="w-6 h-6 text-white" />
            : <Plus className="w-6 h-6 text-primary-foreground" />
          }
        </button>
      </div>

      {/* Quick-add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mode === "sale"
                ? <><TrendingUp className="w-4 h-4 text-green-500" /> إضافة مبيعة سريعة</>
                : <><Receipt className="w-4 h-4 text-orange-500" /> إضافة مصروف سريع</>
              }
            </DialogTitle>
          </DialogHeader>

          {mode === "sale" ? (
            <form onSubmit={handleSaleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>المبلغ (ريال) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  dir="ltr"
                  placeholder="0.00"
                  value={saleForm.amount}
                  onChange={(e) => setSaleForm((f) => ({ ...f, amount: e.target.value }))}
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>خصم (اختياري)</Label>
                <Input
                  type="number"
                  step="0.01"
                  dir="ltr"
                  placeholder="0.00"
                  value={saleForm.discount}
                  onChange={(e) => setSaleForm((f) => ({ ...f, discount: e.target.value }))}
                />
              </div>
              {saleForm.amount && (
                <div className="bg-muted rounded p-2 text-sm flex justify-between">
                  <span className="text-muted-foreground">الصافي</span>
                  <span className="font-semibold">
                    {new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(
                      Math.max(0, Number(saleForm.amount) - Number(saleForm.discount || 0))
                    )}
                  </span>
                </div>
              )}
              <Button type="submit" className="w-full bg-green-500 hover:bg-green-600" disabled={addSale.isPending}>
                {addSale.isPending ? "جاري الحفظ..." : "حفظ المبيعة الآن"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleExpSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>المبلغ (ريال) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  dir="ltr"
                  placeholder="0.00"
                  value={expForm.amount}
                  onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))}
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>التصنيف</Label>
                <Select
                  value={expForm.category}
                  onValueChange={(v) => setExpForm((f) => ({ ...f, category: v as ExpenseCategory }))}
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
                <Label>وصف (اختياري)</Label>
                <Input
                  placeholder="تفاصيل المصروف"
                  value={expForm.description}
                  onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600" disabled={addExpense.isPending}>
                {addExpense.isPending ? "جاري الحفظ..." : "حفظ المصروف الآن"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
