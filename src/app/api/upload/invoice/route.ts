import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { extractInvoiceData } from "@/server/services/ocr-service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: user.id },
    include: { tenants: { take: 1 } },
  });
  if (!dbUser?.tenants[0]) {
    return NextResponse.json({ error: "No tenant" }, { status: 403 });
  }
  const tenantId = dbUser.tenants[0].tenantId;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
  }

  // Upload to Supabase Storage
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const fileName = `${tenantId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(fileName, buffer, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  const { data: { publicUrl } } = supabase.storage.from("invoices").getPublicUrl(uploadData.path);

  // Create invoice record
  const invoice = await prisma.purchaseInvoice.create({
    data: {
      tenantId,
      fileUrl: publicUrl,
      fileName: file.name,
      fileType: file.type,
      status: "OCR_PROCESSING",
    },
  });

  // Run OCR (skip PDFs for now — only images)
  if (file.type !== "application/pdf") {
    try {
      const base64 = buffer.toString("base64");
      const ocrResult = await extractInvoiceData(base64, file.type);

      await prisma.purchaseInvoice.update({
        where: { id: invoice.id },
        data: {
          status: "OCR_COMPLETE",
          supplierName: ocrResult.supplierName,
          invoiceNumber: ocrResult.invoiceNumber,
          invoiceDate: ocrResult.invoiceDate ? new Date(ocrResult.invoiceDate) : null,
          amount: ocrResult.amount,
          vat: ocrResult.vat,
          totalAmount: ocrResult.totalAmount,
          currency: ocrResult.currency,
          ocrOutput: ocrResult as object,
          ocrConfidence: ocrResult.confidence,
          lineItems: {
            createMany: {
              data: ocrResult.lineItems.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                unit: item.unit,
              })),
            },
          },
        },
      });

      return NextResponse.json({ invoiceId: invoice.id, ocr: ocrResult });
    } catch {
      await prisma.purchaseInvoice.update({
        where: { id: invoice.id },
        data: { status: "NEEDS_REVIEW" },
      });
    }
  } else {
    await prisma.purchaseInvoice.update({
      where: { id: invoice.id },
      data: { status: "NEEDS_REVIEW" },
    });
  }

  return NextResponse.json({ invoiceId: invoice.id });
}
