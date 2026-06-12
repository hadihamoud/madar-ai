"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const VAT_RATE = 0.15;

export function InvoiceCreateDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    supplierName: "",
    supplierId: "",
    invoiceNumber: "",
    invoiceDate: format(new Date(), "yyyy-MM-dd"),
    amount: "",
    vatAuto: true,
    vat: "",
    category: "",
    notes: "",
  });

  const { data: suppliers } = trpc.suppliers.list.useQuery({ activeOnly: true }, { enabled: open });
  const utils = trpc.useUtils();

  const create = trpc.invoices.create.useMutation({
    onSuccess: () => {
      toast.success("تم إنشاء الفاتورة");
      utils.invoices.list.invalidate();
      setOpen(false);
      resetForm();
      onCreated?.();
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ supplierName: "", supplierId: "", invoiceNumber: "", invoiceDate: format(new Date(), "yyyy-MM-dd"), amount: "", vatAuto: true, vat: "", category: "", notes: "" });
  }

  const amount = Number(form.amount) || 0;
  const vat = form.vatAuto ? amount * VAT_RATE : Number(form.vat) || 0;
  const total = amount + vat;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) { toast.error("أدخل مبلغ الفاتورة"); return; }
    const supplier = suppliers?.find((s) => s.id === form.supplierId);
    create.mutate({
      supplierName: form.supplierName || supplier?.name || undefined,
      supplierId: form.supplierId || undefined,
      invoiceNumber: form.invoiceNumber || undefined,
      invoiceDate: new Date(form.invoiceDate),
      amount,
      vat,
      totalAmount: total,
      category: form.category || undefined,
      notes: form.notes || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 ml-1.5" />
          إدخال يدوي
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>إنشاء فاتورة شراء يدوياً</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Supplier */}
          <div className="space-y-2">
            <Label>المورد</Label>
            {suppliers && suppliers.length > 0 ? (
              <Select
                value={form.supplierId}
                onValueChange={(v) => {
                  const sup = suppliers.find((s) => s.id === v);
                  setForm((f) => ({ ...f, supplierId: v, supplierName: sup?.name ?? "" }));
                }}
              >
                <SelectTrigger><SelectValue placeholder="اختر مورداً أو اكتب اسماً" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : null}
            {!form.supplierId && (
              <Input
                placeholder="اسم المورد (إذا لم يكن في القائمة)"
                value={form.supplierName}
                onChange={(e) => setForm((f) => ({ ...f, supplierName: e.target.value }))}
              />
            )}
            {form.supplierId && (
              <button type="button" className="text-xs text-primary" onClick={() => setForm((f) => ({ ...f, supplierId: "", supplierName: "" }))}>
                مسح الاختيار
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>رقم الفاتورة</Label>
              <Input
                dir="ltr"
                placeholder="INV-001"
                value={form.invoiceNumber}
                onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الفاتورة</Label>
              <Input
                type="date"
                dir="ltr"
                value={form.invoiceDate}
                onChange={(e) => setForm((f) => ({ ...f, invoiceDate: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>المبلغ قبل الضريبة (ريال) *</Label>
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

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>ضريبة القيمة المضافة</Label>
              <button
                type="button"
                className="text-xs text-primary"
                onClick={() => setForm((f) => ({ ...f, vatAuto: !f.vatAuto, vat: "" }))}
              >
                {form.vatAuto ? "إدخال يدوي" : "حساب تلقائي (15%)"}
              </button>
            </div>
            {form.vatAuto ? (
              <div className="bg-muted rounded px-3 py-2 text-sm flex justify-between">
                <span className="text-muted-foreground">15% × {amount.toFixed(2)}</span>
                <span className="font-medium">{vat.toFixed(2)} ريال</span>
              </div>
            ) : (
              <Input
                type="number"
                step="0.01"
                dir="ltr"
                placeholder="0.00"
                value={form.vat}
                onChange={(e) => setForm((f) => ({ ...f, vat: e.target.value }))}
              />
            )}
          </div>

          {amount > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex justify-between text-sm font-semibold">
              <span>الإجمالي شاملاً الضريبة</span>
              <span>{new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(total)}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>التصنيف (اختياري)</Label>
            <Input
              placeholder="مواد غذائية، مشروبات، تجهيزات..."
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            />
          </div>

          <Button type="submit" className="w-full" disabled={create.isPending}>
            {create.isPending ? "جاري الحفظ..." : "إنشاء الفاتورة"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
