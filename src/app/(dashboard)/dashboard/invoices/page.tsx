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
import { Upload, FileText, CheckCircle, AlertCircle, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

function formatSAR(amount: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR" }).format(amount);
}

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

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.invoices.list.useQuery({ limit: 50 });
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

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">فواتير الشراء</h1>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
        } ${uploading ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input {...getInputProps()} />
        <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="font-medium">
          {isDragActive ? "أفلت الملف هنا..." : "اسحب وأفلت الفاتورة هنا"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          أو انقر للاختيار • JPG, PNG, PDF • حتى 10MB
        </p>
        {uploading && (
          <div className="mt-4 max-w-xs mx-auto">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {uploadProgress < 80 ? "جاري الرفع..." : "جاري الاستخراج بالذكاء الاصطناعي..."}
            </p>
          </div>
        )}
      </div>

      {/* Invoice List */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
        </div>
      )}

      <div className="space-y-2">
        {data?.items.map((inv) => {
          const statusInfo = STATUS_MAP[inv.status] ?? STATUS_MAP.PENDING;
          const StatusIcon = statusInfo.icon;
          return (
            <Card
              key={inv.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedInvoice(inv.id)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{inv.supplierName ?? "مورد غير محدد"}</p>
                    <p className="text-xs text-muted-foreground">
                      {inv.invoiceDate
                        ? format(new Date(inv.invoiceDate), "d MMM yyyy", { locale: ar })
                        : format(new Date(inv.createdAt), "d MMM yyyy", { locale: ar })}
                      {inv.invoiceNumber && ` • ${inv.invoiceNumber}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="font-semibold text-sm">
                    {inv.totalAmount ? formatSAR(Number(inv.totalAmount)) : "—"}
                  </p>
                  <Badge variant={statusInfo.color as "default" | "secondary" | "outline" | "destructive"}>
                    <StatusIcon className="w-3 h-3 ml-1" />
                    {statusInfo.label}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {!isLoading && data?.items.length === 0 && (
          <p className="text-center text-muted-foreground py-12">لا توجد فواتير بعد. ارفع أول فاتورة!</p>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اسم المورد</Label>
                  <Input
                    defaultValue={invoice.supplierName ?? ""}
                    onBlur={(e) =>
                      updateInvoice.mutate({ id: invoice.id, supplierName: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>رقم الفاتورة</Label>
                  <Input
                    defaultValue={invoice.invoiceNumber ?? ""}
                    dir="ltr"
                    onBlur={(e) =>
                      updateInvoice.mutate({ id: invoice.id, invoiceNumber: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>المبلغ (قبل الضريبة)</Label>
                  <Input
                    type="number"
                    defaultValue={invoice.amount ? Number(invoice.amount) : ""}
                    dir="ltr"
                    onBlur={(e) =>
                      updateInvoice.mutate({ id: invoice.id, amount: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>ضريبة القيمة المضافة</Label>
                  <Input
                    type="number"
                    defaultValue={invoice.vat ? Number(invoice.vat) : ""}
                    dir="ltr"
                    onBlur={(e) =>
                      updateInvoice.mutate({ id: invoice.id, vat: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>الإجمالي</Label>
                  <Input
                    type="number"
                    defaultValue={invoice.totalAmount ? Number(invoice.totalAmount) : ""}
                    dir="ltr"
                    onBlur={(e) =>
                      updateInvoice.mutate({ id: invoice.id, totalAmount: Number(e.target.value) })
                    }
                  />
                </div>
              </div>

              {invoice.lineItems && invoice.lineItems.length > 0 && (
                <div>
                  <Label className="mb-2 block">البنود</Label>
                  <div className="space-y-1 text-sm">
                    {invoice.lineItems.map((item) => (
                      <div key={item.id} className="flex justify-between py-1 border-b border-muted last:border-0">
                        <span>{item.description}</span>
                        <span>{formatSAR(Number(item.totalPrice))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {invoice.ocrConfidence && (
                <p className="text-xs text-muted-foreground">
                  دقة الاستخراج التلقائي: {Math.round(invoice.ocrConfidence * 100)}%
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    updateInvoice.mutate({ id: invoice.id, status: "APPROVED" });
                    setSelectedInvoice(null);
                  }}
                >
                  <CheckCircle className="w-4 h-4 ml-2" />
                  موافقة
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    updateInvoice.mutate({ id: invoice.id, status: "REJECTED" });
                    setSelectedInvoice(null);
                  }}
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
