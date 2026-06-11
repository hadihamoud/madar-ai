import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function VerifyEmailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>تحقق من بريدك الإلكتروني</CardTitle>
        <CardDescription>
          أرسلنا رابط التحقق إلى بريدك الإلكتروني. افتح البريد وانقر على الرابط للمتابعة.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/login">
          <Button variant="outline" className="w-full">العودة لتسجيل الدخول</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
