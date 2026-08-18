"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { withTransaction } from "@/db";
import { cashTransactions } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { cashTransactionSchema, cashBulkImportSchema } from "@/lib/validators/cash-transaction";

export async function createManualCashTransaction(formData: FormData) {
  const parsed = cashTransactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  let newId = "";

  try {
    await withAudit(
      { entityType: "cash_transaction", entityId: () => newId, action: "create", actorId },
      async (tx) => {
        const [inserted] = await tx
          .insert(cashTransactions)
          .values({
            txnDate: parsed.data.txnDate,
            accountId: parsed.data.accountId,
            direction: parsed.data.direction,
            amount: String(parsed.data.amount),
            categoryId: parsed.data.categoryId || null,
            relatedType: "manual",
            description: parsed.data.description,
            createdBy: actorId,
          })
          .returning();
        newId = inserted.id;
      }
    );
  } catch {
    return { error: "Gagal menyimpan transaksi" };
  }

  revalidatePath("/cash-flow");
  return { success: true };
}

export async function editManualCashTransaction(id: string, formData: FormData) {
  const parsed = cashTransactionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "cash_transaction", entityId: id, action: "update", actorId },
      async (tx) => {
        const [existing] = await tx
          .select({ relatedType: cashTransactions.relatedType, isDeleted: cashTransactions.isDeleted })
          .from(cashTransactions)
          .where(eq(cashTransactions.id, id));
        if (!existing || existing.isDeleted) throw new Error("Transaksi tidak ditemukan");
        if (existing.relatedType !== "manual") {
          throw new Error("Transaksi otomatis tidak bisa diedit di sini");
        }
        await tx
          .update(cashTransactions)
          .set({
            txnDate: parsed.data.txnDate,
            accountId: parsed.data.accountId,
            direction: parsed.data.direction,
            amount: String(parsed.data.amount),
            categoryId: parsed.data.categoryId || null,
            description: parsed.data.description,
          })
          .where(eq(cashTransactions.id, id));
      }
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal mengubah transaksi" };
  }

  revalidatePath("/cash-flow");
  return { success: true };
}

export async function bulkImportCashTransactions(formData: FormData) {
  const raw = Object.fromEntries(formData);
  let rows: unknown;
  try {
    rows = JSON.parse(String(raw.rowsJson ?? "[]"));
  } catch {
    return { error: "Data tidak valid" };
  }

  const parsed = cashBulkImportSchema.safeParse({ rows });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();

  try {
    await withTransaction(async (tx) => {
      await tx.insert(cashTransactions).values(
        parsed.data.rows.map((r) => ({
          txnDate: r.txnDate,
          accountId: r.accountId,
          direction: r.direction,
          amount: String(r.amount),
          categoryId: r.categoryId || null,
          relatedType: "manual" as const,
          description: r.description,
          createdBy: actorId,
        }))
      );
    });
  } catch {
    return { error: "Gagal mengimpor transaksi" };
  }

  revalidatePath("/cash-flow");
  return { success: true, insertedCount: parsed.data.rows.length };
}

export async function deleteManualCashTransaction(id: string) {
  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "cash_transaction", entityId: id, action: "delete", actorId },
      async (tx) => {
        const [existing] = await tx
          .select({ relatedType: cashTransactions.relatedType, isDeleted: cashTransactions.isDeleted })
          .from(cashTransactions)
          .where(eq(cashTransactions.id, id));
        if (!existing || existing.isDeleted) throw new Error("Transaksi tidak ditemukan");
        if (existing.relatedType !== "manual") {
          throw new Error("Transaksi otomatis tidak bisa dihapus di sini");
        }
        await tx.update(cashTransactions).set({ isDeleted: true }).where(eq(cashTransactions.id, id));
      }
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menghapus transaksi" };
  }

  revalidatePath("/cash-flow");
  return { success: true };
}
