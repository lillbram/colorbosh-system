"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { cashTransactions } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { lockedMonthError } from "@/lib/month-lock";
import { withAudit } from "@/lib/audit";
import { analyze, type ReceiptAnalysis } from "@/lib/receipt-analysis";
import { saveReceipt } from "@/lib/receipt-save";
import { downloadProof, MAX_PROOF_BYTES, PROOF_MIME_TYPES, uploadProof } from "@/lib/proof-storage";
import { claudeVisionEnabled, extractReceiptWithClaude } from "@/lib/receipt-claude";
import type { ExtractedReceipt } from "@/lib/receipt-parser";

const PATH_RE = /^\d{4}\/\d{2}\/[\w-]+\.(jpg|png|webp)$/;

export type { ReceiptAnalysis };

export type ScanResult =
  | {
      ok: true;
      path: string;
      /** null → the browser should run its OCR fallback and call `analyzeReceipt`. */
      extracted: ExtractedReceipt | null;
      analysis: ReceiptAnalysis | null;
    }
  | { ok: false; error: string };

/** Uploads the photo (or reuses an inbox path from the share target) and reads it with Claude when a key is set. */
export async function scanReceipt(formData: FormData): Promise<ScanResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "Sesi tidak valid, silakan masuk ulang" };

  try {
    let path: string;
    let bytes: Buffer;
    let mime: string;

    const existing = String(formData.get("existingPath") ?? "");
    const file = formData.get("file");
    if (existing) {
      if (!PATH_RE.test(existing)) return { ok: false, error: "Foto tidak valid" };
      ({ bytes, mimeType: mime } = await downloadProof(existing));
      path = existing;
    } else if (file instanceof File && file.size > 0) {
      if (file.size > MAX_PROOF_BYTES) return { ok: false, error: "Foto terlalu besar (maksimal 5 MB)" };
      bytes = Buffer.from(await file.arrayBuffer());
      mime = file.type;
      path = await uploadProof(bytes, mime, userId);
    } else {
      return { ok: false, error: "Pilih foto bukti transfer dulu" };
    }

    let extracted: ExtractedReceipt | null = null;
    if (claudeVisionEnabled() && (PROOF_MIME_TYPES as readonly string[]).includes(mime)) {
      extracted = await extractReceiptWithClaude(bytes, mime as (typeof PROOF_MIME_TYPES)[number]);
    }
    return { ok: true, path, extracted, analysis: extracted ? await analyze(extracted) : null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gagal membaca foto" };
  }
}

/** Suggestions for a receipt that was read in the browser (OCR fallback). */
export async function analyzeReceipt(extracted: ExtractedReceipt): Promise<ReceiptAnalysis> {
  return analyze(extracted);
}

const saveSchema = z.object({
  txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  accountId: z.string().uuid("Pilih akun"),
  direction: z.enum(["in", "out"]),
  amount: z.coerce.number().positive("Nominal harus lebih dari 0"),
  adminFee: z.coerce.number().min(0).default(0),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  description: z.string().min(1, "Keterangan wajib diisi"),
  counterparty: z.string().optional(),
  bankRef: z.string().optional(),
  periodMonth: z.string().regex(/^\d{4}-\d{2}$/).optional().or(z.literal("")),
  proofPath: z.string().regex(PATH_RE, "Foto bukti tidak valid"),
  status: z.enum(["draft", "confirmed"]).default("confirmed"),
});

export type SaveResult =
  | { ok: true }
  | { ok: false; error: string; duplicateId?: string };

export async function saveReceiptTransaction(formData: FormData): Promise<SaveResult> {
  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const d = parsed.data;
  const actorId = await getCurrentUserId();
  const bankRef = d.bankRef?.trim() || null;
  const lock = await lockedMonthError([d.txnDate], "bukti transfer");
  if (lock) return { ok: false, error: lock };

  if (bankRef) {
    const [dup] = await db
      .select({ id: cashTransactions.id })
      .from(cashTransactions)
      .where(and(eq(cashTransactions.bankRef, bankRef), eq(cashTransactions.isDeleted, false)));
    if (dup) return { ok: false, error: "Bukti ini sudah tercatat", duplicateId: dup.id };
  }

  const result = await saveReceipt({ ...d, bankRef, counterparty: d.counterparty?.trim() || null }, actorId);
  if (!result.ok) return result;

  revalidatePath("/cash-flow");
  return { ok: true };
}

/** Draft ("perlu dicek") → confirmed. */
export async function confirmCashTransaction(id: string) {
  const actorId = await getCurrentUserId();
  try {
    await withAudit({ entityType: "cash_transaction", entityId: id, action: "update", actorId }, async (tx) => {
      await tx.update(cashTransactions).set({ status: "confirmed" }).where(eq(cashTransactions.id, id));
    });
  } catch {
    return { error: "Gagal mengonfirmasi transaksi" };
  }
  revalidatePath("/cash-flow");
  return { success: true };
}
