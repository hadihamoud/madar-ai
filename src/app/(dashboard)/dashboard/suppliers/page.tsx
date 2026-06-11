"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Users, TrendingUp, Phone, Mail, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { ar } from "date-fns/locale";

function formatSAR(n: number) {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(n);
}

const EMPTY_FORM = { name: "", phone: "", email: "", vatNumber: "", notes: "" };

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const utils = trpc.useUtils();
  const { data: suppliers, isLoading } = trpc.suppliers.list.useQuery({ activeOnly: false });
  const { data: stats } = trpc.suppliers.stats.useQuery({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const create = trpc.suppliers.create.useMutation({
    onSuccess: () => { toast.success("تم إضافة المورد"); utils.suppliers.list.invalidate(); setCreateOpen(false); setForm(EMPTY_FORM); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.suppliers.update.useMutation({
    onSuccess: () => { toast.success("تم التحديث"); utils.suppliers.list.invalidate(); setEditTarget(null); },
    onError: (e) => toast.error(e.message),
  });
  const deactivate = trpc.suppliers.delete.useMutation({
    onSuccess: () => { toast.success("تم التعطيل"); utils.suppliers.list.invalidate(); },
  });

  const filtered = suppliers?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone?.includes(search)
  ) ?? [];

  const active = filtered.filter(s => s.isActive);
  const inactive = filtered.filter(s => !s.isActive);

  function openEdit(s: typeof filtered[0]) {
    setForm({ name: s.name, phone: s.phone ?? "", email: s.email ?? "", vatNumber: s.vatNumber ?? "", notes: s.notes ?? "" });
    setEditTarget(s.id);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">الموردون</h1>
          <p className="text-muted-foreground text-sm">{active.length} مورد نشط</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true); }}>
          <Plus className="w-4 h-4 ml-2" />
          مورد جديد
        </Button>
      </div>

      {/* Top suppliers spending */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {stats.slice(0, 3).map((s, i) => (
            <Card key={s.name} className={i === 0 ? "border-primary/40" : ""}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  i === 0 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}>{i + 1}</div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.count} فاتورة · آخر 30 يوم</p>
                </div>
                <p className="font-bold text-sm mr-auto whitespace-nowrap">{formatSAR(s.total)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث باسم المورد أو الهاتف..." className="pr-10" />
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">نشط ({active.length})</TabsTrigger>
          <TabsTrigger value="inactive">غير نشط ({inactive.length})</TabsTrigger>
        </TabsList>

        {["active", "inactive"].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-2 mt-4">
            {isLoading && [1,2,3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />)}
            {(tab === "active" ? active : inactive).map(supplier => {
              const totalSpend = supplier.invoices.reduce((s, i) => s + Number(i.totalAmount ?? 0), 0);
              const lastInvoice = supplier.invoices[0];
              return (
                <Card key={supplier.id} className="hover:border-primary/40 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold truncate">{supplier.name}</p>
                            {!supplier.isActive && <Badge variant="secondary" className="text-xs">غير نشط</Badge>}
                          </div>
                          <div className="flex flex-wrap gap-3 mt-1">
                            {supplier.phone && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Phone className="w-3 h-3" />{supplier.phone}
                              </span>
                            )}
                            {supplier.email && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3" />{supplier.email}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                            <span>{supplier._count.invoices} فاتورة</span>
                            {lastInvoice?.invoiceDate && (
                              <span>آخر أمر: {format(new Date(lastInvoice.invoiceDate), "d MMM", { locale: ar })}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-left flex-shrink-0">
                        <p className="font-bold text-sm">{formatSAR(totalSpend)}</p>
                        <p className="text-xs text-muted-foreground">آخر 12 فاتورة</p>
                        <div className="flex gap-1 mt-2">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(supplier)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          {supplier.isActive && (
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deactivate.mutate({ id: supplier.id })}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {!isLoading && (tab === "active" ? active : inactive).length === 0 && (
              <p className="text-center text-muted-foreground py-10">
                {tab === "active" ? "لا يوجد موردون نشطون بعد" : "لا يوجد موردون غير نشطين"}
              </p>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create / Edit Dialog */}
      <Dialog open={createOpen || !!editTarget} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditTarget(null); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editTarget ? "تعديل المورد" : "إضافة مورد جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label>اسم المورد *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="شركة التوريد الأولى" required />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الهاتف</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="05xxxxxxxx" dir="ltr" />
              </div>
              <div className="space-y-1.5">
                <Label>البريد الإلكتروني</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="supplier@email.com" dir="ltr" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>الرقم الضريبي</Label>
                <Input value={form.vatNumber} onChange={e => setForm(f => ({ ...f, vatNumber: e.target.value }))} placeholder="300000000000003" dir="ltr" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label>ملاحظات</Label>
                <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="معلومات إضافية..." />
              </div>
            </div>
            <Button
              className="w-full"
              disabled={!form.name || create.isPending || update.isPending}
              onClick={() => {
                if (editTarget) {
                  update.mutate({ id: editTarget, ...form });
                } else {
                  create.mutate(form);
                }
              }}
            >
              {create.isPending || update.isPending ? "جاري الحفظ..." : editTarget ? "حفظ التغييرات" : "إضافة المورد"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
