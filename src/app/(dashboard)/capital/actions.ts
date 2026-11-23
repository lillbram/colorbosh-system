"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { marketplaceBalanceSnapshots } from "@/db/schema";
import { getCurrentUserId, requireRole } from "@/lib/auth";
import { withAudit } from "@/lib/audit";

const schema = z.object({
  channelId: z.string().uuid("Pilih channel"),
  snapshotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid"),
  awaitingDelivery: z.coerce.number().min(0).max(9_999_999_999).default(0),
  settlementProcessing: z.coerce.number().min(0).max(9_999_999_999).default(0),
  refundProcessing: z.coerce.number().min(0).max(9_999_999_999).default(0),
  note: z.string().optional(),
});

export async function addMarketplaceSnapshot(formData: FormData) {
  await requireRole("owner");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const d = parsed.data;
  const actorId = await getCurrentUserId();
  let newId = "";

  try {
    await withAudit({ entityType: "marketplace_snapshot", entityId: () => newId, action: "create", actorId }, async (tx) => {
      const [row] = await tx
        .insert(marketplaceBalanceSnapshots)
        .values({
          channelId: d.channelId,
          snapshotDate: d.snapshotDate,
          awaitingDelivery: String(d.awaitingDelivery),
          settlementProcessing: String(d.settlementProcessing),
          refundProcessing: String(d.refundProcessing),
          note: d.note?.trim() || null,
          createdBy: actorId,
        })
        .returning({ id: marketplaceBalanceSnapshots.id });
      newId = row.id;
    });
  } catch {
    return { error: "Gagal menyimpan saldo marketplace" };
  }
  revalidatePath("/capital");
  return { success: true };
}

export async function deleteMarketplaceSnapshot(id: string) {
  await requireRole("owner");
  const actorId = await getCurrentUserId();
  try {
    await withAudit({ entityType: "marketplace_snapshot", entityId: id, action: "delete", actorId }, async (tx) => {
      await tx.delete(marketplaceBalanceSnapshots).where(eq(marketplaceBalanceSnapshots.id, id));
    });
  } catch {
    return { error: "Gagal menghapus" };
  }
  revalidatePath("/capital");
  return { success: true };
}
