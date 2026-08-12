"use server";

import { revalidatePath } from "next/cache";
import { cashTransactions } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { cashTransactionSchema } from "@/lib/validators/cash-transaction";

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
