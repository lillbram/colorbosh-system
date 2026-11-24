import { eq } from "drizzle-orm";
import { cashTransactions, categories } from "@/db/schema";
import { withAudit } from "@/lib/audit";

export type SaveResult = { ok: true } | { ok: false; error: string; duplicateId?: string };

export type SaveReceiptInput = {
  txnDate: string;
  accountId: string;
  direction: "in" | "out";
  amount: number;
  adminFee: number;
  categoryId?: string;
  description: string;
  counterparty: string | null;
  bankRef: string | null;
  periodMonth?: string;
  proofPath: string;
  status: "draft" | "confirmed";
};

/** Inserts the transaction (+ its admin-fee row) and the audit entry in one transaction. Caller checks the month lock. */
export async function saveReceipt(d: SaveReceiptInput, actorId: string | null, auditExtra?: unknown): Promise<SaveResult> {
  const bankRef = d.bankRef;
  let newId = "";
  try {
    await withAudit(
      { entityType: "cash_transaction", entityId: () => newId, action: "create", actorId, diff: auditExtra },
      async (tx) => {
        const base = {
          txnDate: d.txnDate,
          accountId: d.accountId,
          direction: d.direction,
          relatedType: "manual" as const,
          proofUrl: d.proofPath,
          counterparty: d.counterparty,
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
  return { ok: true };
}
