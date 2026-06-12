import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { tenants: { take: 1 } },
  });
  if (!dbUser?.tenants[0]) return NextResponse.json({ error: "No tenant" }, { status: 403 });
  const tenantId = dbUser.tenants[0].tenantId;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) return NextResponse.json({ error: "Invalid file type" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileName = `${tenantId}/receipts/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(fileName, buffer, { contentType: file.type });

  if (uploadError) return NextResponse.json({ error: "Upload failed" }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from("receipts").getPublicUrl(uploadData.path);

  return NextResponse.json({ url: publicUrl });
}
