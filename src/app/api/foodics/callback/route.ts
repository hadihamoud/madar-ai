import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (!code) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?error=foodics_no_code`);
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  try {
    // Exchange code for token
    const tokenRes = await fetch("https://api.foodics.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: process.env.FOODICS_CLIENT_ID,
        client_secret: process.env.FOODICS_CLIENT_SECRET,
        redirect_uri: process.env.FOODICS_REDIRECT_URI,
        code,
      }),
    });

    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) throw new Error("No access token");

    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      include: { tenants: { take: 1 } },
    });
    if (!dbUser?.tenants[0]) throw new Error("No tenant");

    await prisma.restaurant.upsert({
      where: { tenantId: dbUser.tenants[0].tenantId },
      create: {
        tenantId: dbUser.tenants[0].tenantId,
        name: "My Restaurant",
        foodicsConnected: true,
        foodicsToken: tokenData.access_token,
      },
      update: {
        foodicsConnected: true,
        foodicsToken: tokenData.access_token,
      },
    });

    return NextResponse.redirect(`${appUrl}/dashboard/settings?connected=foodics`);
  } catch {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?error=foodics_failed`);
  }
}
