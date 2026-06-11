"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CheckCircle, Circle, User, Building2, Trophy } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "صاحب المطعم",
  ACCOUNTANT: "محاسب",
  BRANCH_MANAGER: "مدير فرع",
  FINANCE_MANAGER: "مدير مالي",
};

export default function ProfilePage() {
  const utils = trpc.useUtils();
  const { data: profile } = trpc.profile.get.useQuery();
  const { data: onboarding } = trpc.profile.onboardingStatus.useQuery();
  const [name, setName] = useState("");

  useEffect(() => { if (profile?.name) setName(profile.name); }, [profile]);

  const updateProfile = trpc.profile.update.useMutation({
    onSuccess: () => { toast.success("تم تحديث الملف الشخصي"); utils.profile.get.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "U";
  const userTenant = profile?.tenants?.[0];
  const role = userTenant?.role ?? "OWNER";
  const restaurant = userTenant?.tenant?.restaurant;

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">الملف الشخصي</h1>

      {/* Profile Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="text-xl bg-primary text-primary-foreground">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-lg">{profile?.name ?? "—"}</p>
              <p className="text-muted-foreground text-sm">{profile?.email}</p>
              <Badge variant="outline" className="mt-1">{ROLE_LABELS[role] ?? role}</Badge>
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الاسم</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="اسمك الكامل" />
            </div>
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input value={profile?.email ?? ""} disabled className="opacity-60" dir="ltr" />
            </div>
            <Button
              onClick={() => updateProfile.mutate({ name })}
              disabled={!name || updateProfile.isPending}
            >
              {updateProfile.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Restaurant info */}
      {restaurant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              بيانات المطعم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">الاسم</span>
              <span>{restaurant.nameAr ?? restaurant.name}</span>
            </div>
            {restaurant.crNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">رقم السجل التجاري</span>
                <span dir="ltr">{restaurant.crNumber}</span>
              </div>
            )}
            {restaurant.vatNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">الرقم الضريبي</span>
                <span dir="ltr">{restaurant.vatNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Foodics</span>
              <Badge variant={restaurant.foodicsConnected ? "default" : "secondary"}>
                {restaurant.foodicsConnected ? "متصل" : "غير متصل"}
              </Badge>
            </div>
            <Link href="/dashboard/settings">
              <Button variant="outline" size="sm" className="mt-2 w-full">تعديل بيانات المطعم</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Onboarding Checklist */}
      {onboarding && !onboarding.isComplete && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              إتمام الإعداد
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">{onboarding.completedCount} من {onboarding.totalSteps} خطوات</span>
              <span className="font-medium">{onboarding.percentage}%</span>
            </div>
            <Progress value={onboarding.percentage} className="h-2" />
            <div className="space-y-2 mt-2">
              {onboarding.steps.map(step => (
                <div key={step.id} className="flex items-center gap-3 text-sm">
                  {step.done
                    ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    : <Circle className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                  <span className={step.done ? "line-through text-muted-foreground" : ""}>{step.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {onboarding?.isComplete && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
            <div>
              <p className="font-medium">تم إعداد الحساب بالكامل 🎉</p>
              <p className="text-sm text-muted-foreground">مدار AI جاهز للعمل معك</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
