"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { accounts, cashTransactions, categories } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { suggestCategory } from "@/lib/cash-rules";
import { getOldestUnpaidSalaryMonth } from "@/lib/finance";
import { todayJakarta } from "@/lib/period";
import { downloadProof, MAX_PROOF_BYTES, PROOF_MIME_TYPES, uploadProof } from "@/lib/proof-storage";
import { claudeVisionEnabled, extractReceiptWithClaude } from "@/lib/receipt-claude";
import type { ExtractedReceipt } from "@/lib/receipt-parser";

export type ReceiptAnalysis = {
  categoryId: string | null;
  categoryName: string | null;
  periodMonth: string | null;
  needsReview: boolean;
  reason: string;
  accountId: string | null;
  duplicate: { id: string; txnDate: string; amount: number; description: string | null } | null;
};

const PATH_RE = /^\d{4}\/\d{2}\/[\w-]+\.(jpg|png|webp)$/;

async function analyze(r: ExtractedReceipt): Promise<ReceiptAnalysis> {
  const counterparty = r.direction === "out" ? r.recipientName : r.senderName;
  const rule = suggestCategory(
    {
      direction: r.direction,
      counterparty,
      note: r.note,
      description: r.transactionType,
      recipientAccount: r.recipientAccount,
    },
    todayJakarta()
  );

  const [categoryRows, accountRows, dupRows] = await Promise.all([
    rule.categoryName
      ? db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(eq(categories.name, rule.categoryName))
      : Promise.resolve([]),
    db.select({ id: accounts.id }).from(accounts).where(eq(accounts.isActive, true)),
    r.bankRef
      ? db
          .select({
            id: cashTransactions.id,
            txnDate: cashTransactions.txnDate,
            amount: cashTransactions.amount,
            description: cashTransactions.description,
          })
          .from(cashTransactions)
          .where(and(eq(cashTransactions.bankRef, r.bankRef), eq(cashTransactions.isDeleted, false)))
      : Promise.resolve([]),
  ]);

  let periodMonth = rule.periodMonth;
  if (rule.categoryName === "Gaji" && !periodMonth && rule.allocateOldestUnpaid) {
    periodMonth = await getOldestUnpaidSalaryMonth();
  }

  return {
    categoryId: categoryRows[0]?.id ?? null,
    categoryName: categoryRows[0] ? rule.categoryName : null,
    periodMonth,
    needsReview: rule.needsReview,
    reason: rule.reason,
    accountId: accountRows.length === 1 ? accountRows[0].id : null,
    duplicate: dupRows[0]
      ? {
          id: dupRows[0].id,
          txnDate: dupRows[0].txnDate,
          amount: Number(dupRows[0].amount),
          description: dupRows[0].description,
        }
      : null,
  };
}

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

  if (bankRef) {
    const [dup] = await db
      .select({ id: cashTransactions.id })
      .from(cashTransactions)
      .where(and(eq(cashTransactions.bankRef, bankRef), eq(cashTransactions.isDeleted, false)));
    if (dup) return { ok: false, error: "Bukti ini sudah tercatat", duplicateId: dup.id };
  }

  let newId = "";
  try {
    await withAudit(
      { entityType: "cash_transaction", entityId: () => newId, action: "create", actorId },
      async (tx) => {
        const base = {
          txnDate: d.txnDate,
          accountId: d.accountId,
          direction: d.direction,
          relatedType: "manual" as const,
          proofUrl: d.proofPath,
          counterparty: d.counterparty?.trim() || null,
          source: "receipt_scan" as const,
          status: d.status,
          createdBy: actorId,
        };
        const [main] = await tx
          .insert(cashTransactions)
          .values({
            ...base,
            amount: String(d.amount),
            categoryId: d.categoryId || null,
            description: d.description,
            bankRef,
            periodMonth: d.periodMonth || null,
          })
          .returning({ id: cashTransactions.id });
        newId = main.id;

        // Admin fee is its own Uang Keluar row so Biaya Bank adds up on its own.
        if (d.direction === "out" && d.adminFee > 0) {
          const [feeCategory] = await tx
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.name, "Biaya Bank"));
          await tx.insert(cashTransactions).values({
            ...base,
            amount: String(d.adminFee),
            categoryId: feeCategory?.id ?? null,
            description: `Biaya admin: ${d.description}`.slice(0, 200),
            bankRef: bankRef ? `${bankRef}:fee` : null,
            status: "confirmed",
          });
        }
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/cash_transactions_bank_ref_uniq|duplicate key/i.test(message)) {
      return { ok: false, error: "Bukti ini sudah tercatat" };
    }
    return { ok: false, error: "Gagal menyimpan transaksi" };
  }

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
