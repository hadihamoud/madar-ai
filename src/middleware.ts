import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Rate limiting for sensitive routes (in-memory; swap for Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

export async function middleware(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const pathname = request.nextUrl.pathname;

  // Rate limit upload endpoint
  if (pathname.startsWith("/api/upload")) {
    const allowed = rateLimit(`upload:${ip}`, 10, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "تجاوزت الحد المسموح. حاول مرة أخرى بعد دقيقة." },
        { status: 429 }
      );
    }
  }

  // Rate limit tRPC AI calls
  if (pathname.startsWith("/api/trpc/ai.chat") || pathname.startsWith("/api/trpc/ai.generateInsights")) {
    const allowed = rateLimit(`ai:${ip}`, 30, 60_000);
    if (!allowed) {
      return NextResponse.json(
        { error: "الرجاء الانتظار قليلاً قبل إرسال المزيد من الطلبات." },
        { status: 429 }
      );
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
