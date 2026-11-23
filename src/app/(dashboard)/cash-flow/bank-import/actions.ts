"use server";

import { z } from "zod";
import { and, eq, inArray, like, not } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, withTransaction } from "@/db";
import { accounts, cashTransactions } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { lockedMonthError } from "@/lib/month-lock";

const payloadSchema = z.object({
  accountId: z.string().uuid("Pilih akun"),
  statementBalance: z.number().nullable(),
  rows: z
    .array(
      z.object({
        key: z.string().min(1),
        txnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        direction: z.enum(["in", "out"]),
        amount: z.number().positive(),
        description: z.string().min(1),
        counterparty: z.string().nullable(),
        categoryId: z.string().uuid().nullable(),
        needsReview: z.boolean(),
      })
    )
    .min(1, "Tidak ada baris untuk diimpor"),
});

export type BankImportResult =
  | {
      ok: true;
      inserted: number;
      duplicates: number;
      attached: number;
      computedBalance: number;
      statementBalance: number | null;
    }
  | { ok: false; error: string };

/**
 * Imports BRImo e-Statement rows. Idempotent: rows whose `brimo:` key already
 * exists are skipped; a row that matches an existing receipt-scan entry (same
 * account, date, direction, amount) is counted as attached instead of inserted,
 * since that proof already covers the money movement.
 */
export async function importBankStatement(payload: z.input<typeof payloadSchema>): Promise<BankImportResult> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const { accountId, statementBalance } = parsed.data;
  const actorId = await getCurrentUserId();
  const lock = await lockedMonthError(parsed.data.rows.map((r) => r.txnDate), "impor mutasi bank");
  if (lock) return { ok: false, error: lock };

  let inserted = 0;
  let duplicates = 0;
  let attached = 0;

  try {
    await withTransaction(async (tx) => {
      const t = tx as unknown as typeof db;
      const unique = new Map(parsed.data.rows.map((r) => [r.key, r]));
      duplicates += parsed.data.rows.length - unique.size;

      const existing = new Set(
        (
          await t
            .select({ bankRef: cashTransactions.bankRef })
            .from(cashTransactions)
            .where(and(eq(cashTransactions.isDeleted, false), inArray(cashTransactions.bankRef, [...unique.keys()])))
        ).map((r) => r.bankRef)
      );

      // Receipt-scan rows not yet matched to a statement line, counted per (date, direction, amount).
      const receipts = await t
        .select({
          txnDate: cashTransactions.txnDate,
          direction: cashTransactions.direction,
          amount: cashTransactions.amount,
        })
        .from(cashTransactions)
        .where(
          and(
            eq(cashTransactions.isDeleted, false),
            eq(cashTransactions.accountId, accountId),
            eq(cashTransactions.source, "receipt_scan"),
            not(like(cashTransactions.bankRef, "brimo:%"))
          )
        );
      const available = new Map<string, number>();
      for (const r of receipts) {
        const k = `${r.txnDate}|${r.direction}|${Number(r.amount)}`;
        available.set(k, (available.get(k) ?? 0) + 1);
      }

      const toInsert: (typeof cashTransactions.$inferInsert)[] = [];
      for (const row of unique.values()) {
        if (existing.has(row.key)) {
          duplicates += 1;
          continue;
        }
        const k = `${row.txnDate}|${row.direction}|${row.amount}`;
        if ((available.get(k) ?? 0) > 0) {
          available.set(k, available.get(k)! - 1);
          attached += 1;
          continue;
        }
        toInsert.push({
          txnDate: row.txnDate,
          accountId,
          direction: row.direction,
          amount: String(row.amount),
          categoryId: row.categoryId,
          relatedType: "manual",
          description: row.description.slice(0, 300),
          counterparty: row.counterparty,
          bankRef: row.key,
          source: "bank_csv",
          status: row.needsReview ? "draft" : "confirmed",
          createdBy: actorId,
        });
      }

      for (let i = 0; i < toInsert.length; i += 200) {
        await t.insert(cashTransactions).values(toInsert.slice(i, i + 200));
      }
      inserted = toInsert.length;
    });

    const [account] = await db
      .select({ opening: accounts.openingBalance })
      .from(accounts)
      .where(eq(accounts.id, accountId));
    const txns = await db
      .select({ direction: cashTransactions.direction, amount: cashTransactions.amount })
      .from(cashTransactions)
      .where(and(eq(cashTransactions.isDeleted, false), eq(cashTransactions.accountId, accountId)));
    const computedBalance =
      Number(account?.opening ?? 0) +
      txns.reduce((sum, r) => sum + (r.direction === "in" ? 1 : -1) * Number(r.amount), 0);

    revalidatePath("/cash-flow");
    return { ok: true, inserted, duplicates, attached, computedBalance, statementBalance };
  } catch {
    return { ok: false, error: "Gagal mengimpor mutasi" };
  }
}
