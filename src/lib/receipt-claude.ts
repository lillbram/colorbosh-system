import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { ExtractedReceipt } from "@/lib/receipt-parser";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export function claudeVisionEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const PROMPT = `Extract data from an Indonesian bank/e-wallet transfer receipt screenshot (BRImo, BCA, Mandiri, DANA, QRIS...).
Return ONLY JSON matching the schema.
Rupiah as integers without separators. Use null for anything not visible. Never guess amounts.
datetime is Jakarta wall time as YYYY-MM-DDTHH:MM:SS. direction is "out" when money leaves the account shown under "Sumber Dana", "in" when it arrives.`;

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };

const SCHEMA = {
  type: "object",
  properties: {
    datetime: nullableString,
    amount: { anyOf: [{ type: "integer" }, { type: "null" }] },
    admin_fee: { type: "integer" },
    direction: { type: "string", enum: ["out", "in"] },
    sender_name: nullableString,
    recipient_name: nullableString,
    recipient_bank: nullableString,
    recipient_account: nullableString,
    bank_ref: nullableString,
    note: nullableString,
    transaction_type: nullableString,
    confidence: { type: "number" },
  },
  required: [
    "datetime",
    "amount",
    "admin_fee",
    "direction",
    "sender_name",
    "recipient_name",
    "recipient_bank",
    "recipient_account",
    "bank_ref",
    "note",
    "transaction_type",
    "confidence",
  ],
  additionalProperties: false,
} as const;

const responseSchema = z.object({
  datetime: z.string().nullable(),
  amount: z.number().int().nullable(),
  admin_fee: z.number().int().min(0),
  direction: z.enum(["out", "in"]),
  sender_name: z.string().nullable(),
  recipient_name: z.string().nullable(),
  recipient_bank: z.string().nullable(),
  recipient_account: z.string().nullable(),
  bank_ref: z.string().nullable(),
  note: z.string().nullable(),
  transaction_type: z.string().nullable(),
  confidence: z.number(),
});

/**
 * Reads a receipt image with Claude vision. Returns null on any failure
 * (refusal, truncated or invalid JSON, API error) so the caller can fall back
 * to the in-browser OCR — the image is never logged.
 */
export async function extractReceiptWithClaude(
  bytes: Buffer,
  mimeType: "image/jpeg" | "image/png" | "image/webp"
): Promise<ExtractedReceipt | null> {
  if (!claudeVisionEnabled()) return null;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mimeType, data: bytes.toString("base64") } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;

    const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
    if (!text) return null;
    const r = responseSchema.parse(JSON.parse(text));
    return {
      datetime: r.datetime,
      amount: r.amount !== null && r.amount > 0 ? r.amount : null,
      adminFee: r.admin_fee,
      direction: r.direction,
      senderName: r.sender_name,
      recipientName: r.recipient_name,
      recipientBank: r.recipient_bank,
      recipientAccount: r.recipient_account?.replace(/\s/g, "") ?? null,
      bankRef: r.bank_ref,
      note: r.note,
      transactionType: r.transaction_type,
      confidence: Math.max(0, Math.min(1, r.confidence)),
    };
  } catch {
    return null;
  }
}
