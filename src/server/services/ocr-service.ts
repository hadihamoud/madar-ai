import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface OCRResult {
  supplierName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  amount: number | null;
  vat: number | null;
  totalAmount: number | null;
  currency: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    unit?: string;
  }>;
  confidence: number;
  rawText: string;
}

export async function extractInvoiceData(
  fileBase64: string,
  mimeType: string
): Promise<OCRResult> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: fileBase64,
            },
          },
          {
            type: "text",
            text: `Extract all data from this invoice/receipt. Return a JSON object with these exact fields:
{
  "supplierName": "string or null",
  "invoiceNumber": "string or null",
  "invoiceDate": "YYYY-MM-DD or null",
  "amount": number (subtotal before tax) or null,
  "vat": number (VAT/tax amount) or null,
  "totalAmount": number (final total) or null,
  "currency": "SAR",
  "lineItems": [
    {
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number,
      "unit": "string or null"
    }
  ],
  "confidence": number between 0 and 1,
  "rawText": "full text extracted from document"
}

Return ONLY the JSON object, no explanation.`,
          },
        ],
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "{}";

  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as OCRResult;
    }
  } catch {
    // fallback empty result
  }

  return {
    supplierName: null,
    invoiceNumber: null,
    invoiceDate: null,
    amount: null,
    vat: null,
    totalAmount: null,
    currency: "SAR",
    lineItems: [],
    confidence: 0,
    rawText: text,
  };
}
