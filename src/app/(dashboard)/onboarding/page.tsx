"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, ChevronLeft, ChevronRight, Store, Plug, FileText, Receipt } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "welcome", title: "أهلاً بك في مدار AI", icon: Store },
  { id: "profile", title: "بيانات مطعمك", icon: Store },
  { id: "foodics", title: "ربط Foodics", icon: Plug },
  { id: "done", title: "جاهز للانطلاق!", icon: CheckCircle },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [restaurantForm, setRestaurantForm] = useState({
    name: "", nameAr: "", crNumber: "", vatNumber: "", city: "الرياض",
  });

  const upsertRestaurant = trpc.restaurant.upsert.useMutation({
    onSuccess: () => next(),
    onError: (e) => toast.error(e.message),
  });

  const progress = Math.round((step / (STEPS.length - 1)) * 100);

  function next() { setStep((s) => Math.min(s + 1, STEPS.length - 1)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  function handleFoodicsConnect() {
    const clientId = process.env.NEXT_PUBLIC_FOODICS_CLIENT_ID;
    if (!clientId) { toast.info("يمكنك ربط Foodics لاحقاً من الإعدادات"); next(); return; }
    window.location.href = `https://console.foodics.com/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(`${window.location.origin}/api/foodics/callback`)}&response_type=code`;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary mb-1">مدار AI</h1>
          <p className="text-muted-foreground text-sm">لنبدأ في إعداد حسابك</p>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>الخطوة {step + 1} من {STEPS.length}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Step indicators */}
        <div className="flex justify-between mb-8 px-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-col items-center gap-1">
              <div className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all",
                i < step ? "bg-primary border-primary text-primary-foreground" :
                i === step ? "border-primary text-primary" :
                "border-muted text-muted-foreground"
              )}>
                {i < step ? <CheckCircle className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
              </div>
              <span className={cn("text-xs hidden sm:block", i === step ? "text-foreground font-medium" : "text-muted-foreground")}>
                {s.title.split(" ")[0]}
              </span>
            </div>
          ))}
        </div>

        <Card>
          <CardContent className="p-6">
            {/* Step 0: Welcome */}
            {step === 0 && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Store className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-xl font-bold">أهلاً بك في مدار AI 🎉</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  مستشارك المالي الذكي للمطاعم. سنساعدك على فهم أرباحك، تتبع مصروفاتك، وتحليل أداء عملك — كل يوم، بلغة بسيطة.
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {["📊 تقرير يومي تلقائي", "🧾 رفع الفواتير بالذكاء", "💬 اسأل عن أي شيء", "📈 تحليلات فورية"].map(f => (
                    <div key={f} className="bg-muted rounded-lg p-3 text-right">{f}</div>
                  ))}
                </div>
                <Button className="w-full" onClick={next}>ابدأ الإعداد →</Button>
              </div>
            )}

            {/* Step 1: Restaurant Profile */}
            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">بيانات مطعمك</h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>اسم المطعم (عربي)</Label>
                    <Input value={restaurantForm.nameAr} onChange={e => setRestaurantForm(f => ({ ...f, nameAr: e.target.value }))} placeholder="مطعم النخيل" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>English Name *</Label>
                    <Input value={restaurantForm.name} onChange={e => setRestaurantForm(f => ({ ...f, name: e.target.value }))} placeholder="Al Nakheel" dir="ltr" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>رقم السجل التجاري</Label>
                    <Input value={restaurantForm.crNumber} onChange={e => setRestaurantForm(f => ({ ...f, crNumber: e.target.value }))} placeholder="1234567890" dir="ltr" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>الرقم الضريبي</Label>
                    <Input value={restaurantForm.vatNumber} onChange={e => setRestaurantForm(f => ({ ...f, vatNumber: e.target.value }))} placeholder="300000000000003" dir="ltr" />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={back} className="flex-1"><ChevronRight className="w-4 h-4 ml-1" />السابق</Button>
                  <Button
                    className="flex-1"
                    disabled={!restaurantForm.name}
                    onClick={() => upsertRestaurant.mutate(restaurantForm)}
                  >
                    {upsertRestaurant.isPending ? "جاري الحفظ..." : "التالي"}<ChevronLeft className="w-4 h-4 mr-1" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Foodics */}
            {step === 2 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">ربط Foodics</h2>
                <p className="text-sm text-muted-foreground">اربط حساب Foodics الخاص بك لمزامنة المبيعات والطلبات تلقائياً كل 15 دقيقة.</p>
                <div className="bg-muted rounded-xl p-4 space-y-2">
                  {["مزامنة تلقائية للمبيعات", "بيانات الفروع والمنتجات", "تقارير يومية دقيقة"].map(b => (
                    <div key={b} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {b}
                    </div>
                  ))}
                </div>
                <Button className="w-full" onClick={handleFoodicsConnect}>
                  <Plug className="w-4 h-4 ml-2" />
                  ربط Foodics
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={back} className="flex-1"><ChevronRight className="w-4 h-4 ml-1" />السابق</Button>
                  <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={next}>تخطي الآن</Button>
                </div>
              </div>
            )}

            {/* Step 3: Done */}
            {step === 3 && (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-xl font-bold">كل شيء جاهز! 🚀</h2>
                <p className="text-muted-foreground text-sm">حسابك مُعدّ وجاهز. يمكنك الآن:</p>
                <div className="space-y-2 text-sm text-right">
                  {[
                    { icon: Receipt, text: "رفع أول فاتورة مشتريات" },
                    { icon: FileText, text: "تسجيل مصروفاتك اليومية" },
                    { icon: Store, text: "عرض لوحة التحكم" },
                  ].map(({ icon: Icon, text }) => (
                    <div key={text} className="flex items-center gap-3 bg-muted rounded-lg px-3 py-2">
                      <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                      {text}
                    </div>
                  ))}
                </div>
                <Button className="w-full" onClick={() => router.push("/dashboard")}>
                  انطلق إلى لوحة التحكم →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
