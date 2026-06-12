"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, CheckCircle, AlertCircle, Clock, X, Search, CheckSquare, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";

function formatSAR(amount: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount);
}

const STATUS_TABS = [
  { value: undefined, label: "الكل" },
  { value: "NEEDS_REVIEW" as const, label: "تحتاج مراجعة" },
  { value: "APPROVED" as const, label: "موافق عليها" },
  { value: "PENDING" as const, label: "معلقة" },
  { value: "REJECTED" as const, label: "مرفوضة" },
];

const STATUS_MAP = {
  PENDING: { label: "معلق", color: "secondary", icon: Clock },
  OCR_PROCESSING: { label: "جاري المعالجة", color: "secondary", icon: Clock },
  OCR_COMPLETE: { label: "يحتاج مراجعة", color: "outline", icon: AlertCircle },
  NEEDS_REVIEW: { label: "يحتاج مراجعة", color: "outline", icon: AlertCircle },
  APPROVED: { label: "موافق", color: "default", icon: CheckCircle },
  REJECTED: { label: "مرفوض", color: "destructive", icon: X },
} as const;

export default function InvoicesPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.invoices.list.useQuery({
    limit: 100,
    ...(statusFilter ? { status: statusFilter as "PENDING" | "APPROVED" | "REJECTED" | "NEEDS_REVIEW" | "OCR_COMPLETE" | "OCR_PROCESSING" } : {}),
  });
  const { data: invoice } = trpc.invoices.getById.useQuery(
    { id: selectedInvoice! },
    { enabled: !!selectedInvoice }
  );
  const updateInvoice = trpc.invoices.update.useMutation({
    onSuccess: () => {
      toast.success("تم الحفظ");
      utils.invoices.list.invalidate();
    },
  });
  const markPaid = trpc.invoices.markPaid.useMutation({
    onSuccess: () => {
      toast.success("تم تحديث حالة الدفع");
      utils.invoices.list.invalidate();
      utils.invoices.getById.invalidate();
    },
  });
  const batchUpdate = trpc.invoices.batchUpdate.useMutation({
    onSuccess: (data) => {
      toast.success(`تم تحديث ${data.updated} فاتورة`);
      utils.invoices.list.invalidate();
      setSelected(new Set());
    },
    onError: (e) => toast.error(e.message),
  });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(20);
    const formData = new FormData();
    formData.append("file", file);
    try {
      setUploadProgress(50);
      const res = await fetch("/api/upload/invoice", { method: "POST", body: formData });
      setUploadProgress(80);
      const data = await res.json() as { invoiceId?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setUploadProgress(100);
      toast.success("تم رفع الفاتورة وجاري المعالجة");
      utils.invoices.list.invalidate();
      if (data.invoiceId) setSelectedInvoice(data.invoiceId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل رفع الفاتورة");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [utils]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp"], "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploading,
  });

  // Client-side search filter
  const filtered = (data?.items ?? []).filter((inv) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      inv.supplierName?.toLowerCase().includes(q) ||
      inv.invoiceNumber?.toLowerCase().includes(q) ||
      inv.category?.toLowerCase().includes(q)
    );
  });

  const pendingReview = (data?.items ?? []).filter((i) =>
    i.status === "NEEDS_REVIEW" || i.status === "OCR_COMPLETE"
  ).length;

  const totalApproved = (data?.items ?? [])
    .filter((i) => i.status === "APPROVED")
    .reduce((s, i) => s + Number(i.totalAmount ?? 0), 0);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">فواتير الشراء</h1>
          <p className="text-muted-foreground text-sm">
            {pendingReview > 0 && (
              <span className="text-yellow-500 font-medium">{pendingReview} تحتاج مراجعة · </span>
            )}
            موافق عليها: {formatSAR(totalApproved)}
          </p>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50",
          uploading && "opacity-50 cursor-not-allowed"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="font-medium text-sm">
          {isDragActive ? "أفلت الملف هنا..." : "اسحب وأفلت الفاتورة هنا أو انقر للاختيار"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">JPG, PNG, PDF · حتى 10MB · يستخرج البيانات تلقائياً بالذكاء الاصطناعي</p>
        {uploading && (
          <div className="mt-3 max-w-xs mx-auto">
            <Progress value={uploadProgress} className="h-1.5" />
            <p className="text-xs text-muted-foreground mt-1">
              {uploadProgress < 80 ? "جاري الرفع..." : "جاري الاستخراج بالذكاء الاصطناعي..."}
            </p>
          </div>
        )}
      </div>

      {/* Search + Status tabs */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pr-9"
            placeholder="ابحث باسم المورد أو رقم الفاتورة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={String(tab.value)}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                statusFilter === tab.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:border-primary/50"
              )}
            >
              {tab.label}
              {tab.value === "NEEDS_REVIEW" && pendingReview > 0 && (
                <span className="mr-1 bg-yellow-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{pendingReview}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-lg px-4 py-2.5">
          <CheckSquare className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium flex-1">تم تحديد {selected.size} فاتورة</span>
          <Button
            size="sm"
            className="h-7"
            onClick={() => batchUpdate.mutate({ ids: Array.from(selected), status: "APPROVED" })}
            disabled={batchUpdate.isPending}
          >
            <CheckCircle className="w-3.5 h-3.5 ml-1.5" />
            موافقة على الكل
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-7"
            onClick={() => batchUpdate.mutate({ ids: Array.from(selected), status: "REJECTED" })}
            disabled={batchUpdate.isPending}
          >
            رفض الكل
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setSelected(new Set())}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Select-all row */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={selected.size === filtered.length && filtered.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span>تحديد الكل ({filtered.length})</span>
        </div>
      )}

      {/* Invoice List */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map((inv) => {
          const statusInfo = STATUS_MAP[inv.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.PENDING;
          const StatusIcon = statusInfo.icon;
          const isSelected = selected.has(inv.id);
          return (
            <Card
              key={inv.id}
              className={cn(
                "cursor-pointer hover:border-primary/50 transition-colors",
                isSelected && "border-primary bg-primary/5"
              )}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelect(inv.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div
                  className="flex items-center justify-between flex-1 gap-3 min-w-0"
                  onClick={() => setSelectedInvoice(inv.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{inv.supplierName ?? "مورد غير محدد"}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.invoiceDate
                          ? format(new Date(inv.invoiceDate), "d MMM yyyy", { locale: ar })
                          : format(new Date(inv.createdAt), "d MMM yyyy", { locale: ar })}
                        {inv.invoiceNumber && ` · ${inv.invoiceNumber}`}
                        {inv.category && ` · ${inv.category}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <p className="font-semibold text-sm">
                      {inv.totalAmount ? formatSAR(Number(inv.totalAmount)) : "—"}
                    </p>
                    <Badge variant={statusInfo.color as "default" | "secondary" | "outline" | "destructive"}>
                      <StatusIcon className="w-3 h-3 ml-1" />
                      {statusInfo.label}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-12">
            {search ? "لا توجد نتائج مطابقة" : "لا توجد فواتير بعد. ارفع أول فاتورة!"}
          </p>
        )}
      </div>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تفاصيل الفاتورة</DialogTitle>
          </DialogHeader>
          {invoice && (
            <div className="space-y-4">
              {invoice.fileUrl && (
                <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer" className="block">
                  <div className="border rounded-lg p-2 text-center text-xs text-primary hover:bg-muted transition-colors">
                    <FileText className="w-4 h-4 mx-auto mb-1" />
                    عرض الملف الأصلي
                  </div>
                </a>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم المورد</Label>
                  <Input
                    defaultValue={invoice.supplierName ?? ""}
                    onBlur={(e) => updateInvoice.mutate({ id: invoice.id, supplierName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>رقم الفاتورة</Label>
                  <Input
                    defaultValue={invoice.invoiceNumber ?? ""}
                    dir="ltr"
                    onBlur={(e) => updateInvoice.mutate({ id: invoice.id, invoiceNumber: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>المبلغ (قبل الضريبة)</Label>
                  <Input
                    type="number"
                    defaultValue={invoice.amount ? Number(invoice.amount) : ""}
                    dir="ltr"
                    onBlur={(e) => updateInvoice.mutate({ id: invoice.id, amount: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ضريبة القيمة المضافة</Label>
                  <Input
                    type="number"
                    defaultValue={invoice.vat ? Number(invoice.vat) : ""}
                    dir="ltr"
                    onBlur={(e) => updateInvoice.mutate({ id: invoice.id, vat: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>الإجمالي</Label>
                  <Input
                    type="number"
                    defaultValue={invoice.totalAmount ? Number(invoice.totalAmount) : ""}
                    dir="ltr"
                    onBlur={(e) => updateInvoice.mutate({ id: invoice.id, totalAmount: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>الفئة / التصنيف</Label>
                  <Input
                    defaultValue={invoice.category ?? ""}
                    placeholder="مثال: مواد غذائية، مشروبات..."
                    onBlur={(e) => updateInvoice.mutate({ id: invoice.id, category: e.target.value })}
                  />
                </div>
              </div>

              {invoice.lineItems && invoice.lineItems.length > 0 && (
                <div>
                  <Label className="mb-2 block">البنود ({invoice.lineItems.length})</Label>
                  <div className="space-y-1 text-sm border rounded-lg divide-y">
                    {invoice.lineItems.map((item) => (
                      <div key={item.id} className="flex justify-between px-3 py-2">
                        <span className="text-muted-foreground truncate ml-2">{item.description}</span>
                        <span className="font-medium flex-shrink-0">{formatSAR(Number(item.totalPrice))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {invoice.ocrConfidence && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>دقة الاستخراج التلقائي:</span>
                  <Progress value={invoice.ocrConfidence * 100} className="h-1.5 flex-1" />
                  <span>{Math.round(invoice.ocrConfidence * 100)}%</span>
                </div>
              )}

              {/* Payment status */}
              <div className={`flex items-center justify-between p-3 rounded-lg border ${(invoice as { isPaid?: boolean }).isPaid ? "border-green-500/30 bg-green-500/5" : "border-orange-500/20 bg-orange-500/5"}`}>
                <div className="flex items-center gap-2">
                  <CreditCard className={`w-4 h-4 ${(invoice as { isPaid?: boolean }).isPaid ? "text-green-500" : "text-orange-400"}`} />
                  <span className="text-sm font-medium">
                    {(invoice as { isPaid?: boolean }).isPaid ? "مدفوعة" : "غير مدفوعة"}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => markPaid.mutate({ id: invoice.id, isPaid: !(invoice as { isPaid?: boolean }).isPaid })}
                  disabled={markPaid.isPending}
                >
                  {(invoice as { isPaid?: boolean }).isPaid ? "تحديد كغير مدفوع" : "تحديد كمدفوع"}
                </Button>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={() => { updateInvoice.mutate({ id: invoice.id, status: "APPROVED" }); setSelectedInvoice(null); }}
                  disabled={updateInvoice.isPending || invoice.status === "APPROVED"}
                >
                  <CheckCircle className="w-4 h-4 ml-2" />
                  موافقة
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => { updateInvoice.mutate({ id: invoice.id, status: "REJECTED" }); setSelectedInvoice(null); }}
                  disabled={updateInvoice.isPending || invoice.status === "REJECTED"}
                >
                  رفض
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
