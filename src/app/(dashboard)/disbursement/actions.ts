"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { payouts, cashTransactions } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { confirmPayoutSchema } from "@/lib/validators/disbursement";

export async function confirmPayout(formData: FormData) {
  const parsed = confirmPayoutSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  let newPayoutId = "";

  try {
    await withAudit(
      { entityType: "payout", entityId: () => newPayoutId, action: "create", actorId },
      async (tx) => {
        const [payout] = await tx
          .insert(payouts)
          .values({
            channelId: parsed.data.channelId,
            actualDate: parsed.data.actualDate,
            actualAmount: String(parsed.data.actualAmount),
            bankRef: parsed.data.bankRef || null,
            notes: parsed.data.notes || null,
            createdBy: actorId,
          })
          .returning({ id: payouts.id });

        newPayoutId = payout.id;

        await tx.insert(cashTransactions).values({
          txnDate: parsed.data.actualDate,
          accountId: parsed.data.accountId,
          direction: "in",
          amount: String(parsed.data.actualAmount),
          relatedType: "payout",
          relatedId: payout.id,
          description: `Pencairan dana channel`,
          createdBy: actorId,
        });
      }
    );
  } catch {
    return { error: "Gagal mencatat pencairan dana" };
  }

  revalidatePath("/disbursement");
  revalidatePath("/cash-flow");
  return { success: true };
}

export async function voidPayout(id: string) {
  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "payout", entityId: id, action: "delete", actorId },
      async (tx) => {
        const [payout] = await tx
          .select({ id: payouts.id, isDeleted: payouts.isDeleted })
          .from(payouts)
          .where(eq(payouts.id, id));
        if (!payout || payout.isDeleted) {
          throw new Error("Pencairan tidak ditemukan atau sudah dibatalkan");
        }

        await tx.update(payouts).set({ isDeleted: true }).where(eq(payouts.id, id));
        await tx
          .update(cashTransactions)
          .set({ isDeleted: true })
          .where(and(eq(cashTransactions.relatedType, "payout"), eq(cashTransactions.relatedId, id)));
      }
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal membatalkan pencairan" };
  }

  revalidatePath("/disbursement");
  revalidatePath("/cash-flow");
  return { success: true };
}
