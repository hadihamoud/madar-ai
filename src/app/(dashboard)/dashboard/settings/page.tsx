"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, RefreshCw, Plug, Unplug, Target } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const CITIES = ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "أبها", "تبوك", "أخرى"];
const TIMEZONES = [
  { value: "Asia/Riyadh", label: "توقيت السعودية (AST)" },
  { value: "Asia/Dubai", label: "توقيت الإمارات (GST)" },
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  const { data: restaurant, isLoading } = trpc.restaurant.get.useQuery();
  const { data: foodicsStatus } = trpc.foodics.getStatus.useQuery();
  const upsert = trpc.restaurant.upsert.useMutation({
    onSuccess: () => {
      toast.success("تم الحفظ");
      utils.restaurant.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const disconnect = trpc.foodics.disconnect.useMutation({
    onSuccess: () => {
      toast.success("تم قطع الاتصال");
      utils.foodics.getStatus.invalidate();
    },
  });
  const sync = trpc.foodics.triggerSync.useMutation({
    onSuccess: () => toast.success("تم المزامنة"),
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    name: "",
    nameAr: "",
    crNumber: "",
    vatNumber: "",
    city: "",
    timezone: "Asia/Riyadh",
    currency: "SAR",
  });
  const [targets, setTargets] = useState({ monthlyRevenueTarget: "", monthlyProfitTarget: "" });

  const setTargetsMutation = trpc.restaurant.setTargets.useMutation({
    onSuccess: () => { toast.success("تم حفظ الأهداف"); utils.restaurant.get.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (restaurant) {
      setForm({
        name: restaurant.name ?? "",
        nameAr: restaurant.nameAr ?? "",
        crNumber: restaurant.crNumber ?? "",
        vatNumber: restaurant.vatNumber ?? "",
        city: restaurant.city ?? "",
        timezone: restaurant.timezone ?? "Asia/Riyadh",
        currency: restaurant.currency ?? "SAR",
      });
      setTargets({
        monthlyRevenueTarget: restaurant.monthlyRevenueTarget ? String(restaurant.monthlyRevenueTarget) : "",
        monthlyProfitTarget: restaurant.monthlyProfitTarget ? String(restaurant.monthlyProfitTarget) : "",
      });
    }
  }, [restaurant]);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    if (connected === "foodics") toast.success("تم ربط Foodics بنجاح!");
    if (error === "foodics_failed") toast.error("فشل ربط Foodics");
    if (error === "foodics_no_code") toast.error("لم يتم الحصول على رمز التفويض");
  }, [searchParams]);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { toast.error("اسم المطعم مطلوب"); return; }
    upsert.mutate(form);
  }

  function handleFoodicsConnect() {
    const clientId = process.env.NEXT_PUBLIC_FOODICS_CLIENT_ID;
    if (!clientId) {
      toast.error("Foodics Client ID غير مضبوط");
      return;
    }
    const redirectUri = encodeURIComponent(`${window.location.origin}/api/foodics/callback`);
    window.location.href = `https://console.foodics.com/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code`;
  }

  if (isLoading) {
    return <div className="p-6"><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">الإعدادات</h1>

      {/* Restaurant Profile */}
      <Card>
        <CardHeader>
          <CardTitle>بيانات المطعم</CardTitle>
          <CardDescription>معلومات المطعم الأساسية</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم المطعم (عربي)</Label>
                <Input
                  value={form.nameAr}
                  onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                  placeholder="مطعم النخيل"
                />
              </div>
              <div className="space-y-2">
                <Label>Restaurant Name (English)</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Al Nakheel Restaurant"
                  dir="ltr"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>رقم السجل التجاري</Label>
                <Input
                  value={form.crNumber}
                  onChange={(e) => setForm((f) => ({ ...f, crNumber: e.target.value }))}
                  placeholder="1234567890"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>الرقم الضريبي</Label>
                <Input
                  value={form.vatNumber}
                  onChange={(e) => setForm((f) => ({ ...f, vatNumber: e.target.value }))}
                  placeholder="300000000000003"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>المدينة</Label>
                <Select value={form.city} onValueChange={(v) => setForm((f) => ({ ...f, city: v ?? "" }))}>
                  <SelectTrigger><SelectValue placeholder="اختر المدينة" /></SelectTrigger>
                  <SelectContent>
                    {CITIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>المنطقة الزمنية</Label>
                <Select value={form.timezone} onValueChange={(v) => setForm((f) => ({ ...f, timezone: v ?? "Asia/Riyadh" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={upsert.isPending}>
              {upsert.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Monthly Targets */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            الأهداف الشهرية
          </CardTitle>
          <CardDescription>حدد أهداف المبيعات والربح لتتبع التقدم في لوحة التحكم</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>هدف المبيعات الشهرية (ريال)</Label>
              <Input
                type="number"
                dir="ltr"
                placeholder="مثال: 100000"
                value={targets.monthlyRevenueTarget}
                onChange={(e) => setTargets((t) => ({ ...t, monthlyRevenueTarget: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>هدف صافي الربح الشهري (ريال)</Label>
              <Input
                type="number"
                dir="ltr"
                placeholder="مثال: 20000"
                value={targets.monthlyProfitTarget}
                onChange={(e) => setTargets((t) => ({ ...t, monthlyProfitTarget: e.target.value }))}
              />
            </div>
          </div>
          <Button
            className="mt-4"
            disabled={setTargetsMutation.isPending}
            onClick={() =>
              setTargetsMutation.mutate({
                monthlyRevenueTarget: targets.monthlyRevenueTarget ? Number(targets.monthlyRevenueTarget) : undefined,
                monthlyProfitTarget: targets.monthlyProfitTarget ? Number(targets.monthlyProfitTarget) : undefined,
              })
            }
          >
            {setTargetsMutation.isPending ? "جاري الحفظ..." : "حفظ الأهداف"}
          </Button>
        </CardContent>
      </Card>

      {/* Foodics Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="w-5 h-5" />
            ربط Foodics
          </CardTitle>
          <CardDescription>اربط حساب Foodics لمزامنة المبيعات والطلبات تلقائياً</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {foodicsStatus?.foodicsConnected ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium text-sm">متصل بـ Foodics</p>
                  {foodicsStatus.lastSyncAt && (
                    <p className="text-xs text-muted-foreground">
                      آخر مزامنة: {new Date(foodicsStatus.lastSyncAt).toLocaleString("ar-SA")}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="mr-auto text-green-600 border-green-600">نشط</Badge>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">غير متصل</p>
              </>
            )}
          </div>

          <div className="flex gap-2">
            {foodicsStatus?.foodicsConnected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sync.mutate({ type: "all" })}
                  disabled={sync.isPending}
                >
                  <RefreshCw className={`w-4 h-4 ml-2 ${sync.isPending ? "animate-spin" : ""}`} />
                  مزامنة الآن
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => disconnect.mutate()}
                  disabled={disconnect.isPending}
                >
                  <Unplug className="w-4 h-4 ml-2" />
                  قطع الاتصال
                </Button>
              </>
            ) : (
              <Button onClick={handleFoodicsConnect}>
                <Plug className="w-4 h-4 ml-2" />
                ربط Foodics
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-6"><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}
