"use server";

import { and, eq, gte, lt, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  productionBatches,
  productionBatchProducts,
  productionBatchCostItems,
  tailorPayments,
  cashTransactions,
} from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit, writeAuditLog } from "@/lib/audit";
import {
  productionBatchSchema,
  finishBatchSchema,
  payTerminSchema,
  editTerminAmountSchema,
} from "@/lib/validators/production-batch";

async function generateBatchCode() {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(productionBatches)
    .where(gte(productionBatches.createdAt, startOfDay));

  return `BATCH-${datePart}-${String(count + 1).padStart(3, "0")}`;
}

export async function createProductionBatch(formData: FormData) {
  const raw = Object.fromEntries(formData);
  let products: unknown;
  let costItems: unknown;
  try {
    products = JSON.parse(String(raw.productsJson ?? "[]"));
    costItems = JSON.parse(String(raw.costItemsJson ?? "[]"));
  } catch {
    return { error: "Data produk atau biaya tidak valid" };
  }

  const parsed = productionBatchSchema.safeParse({ ...raw, products, costItems });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  const batchCode = await generateBatchCode();

  const targetQty = parsed.data.products.reduce((sum, p) => sum + p.qty, 0);
  const termin1Amount = Math.round(parsed.data.termin1Amount);

  let newId = "";

  try {
    await withAudit(
      { entityType: "production_batch", entityId: () => newId, action: "create", actorId },
      async (tx) => {
        const [batch] = await tx
          .insert(productionBatches)
          .values({
            batchCode,
            tailorId: parsed.data.tailorId,
            fabricSource: parsed.data.fabricSource,
            fabricUsedMeters:
              parsed.data.fabricUsedMeters !== undefined
                ? String(parsed.data.fabricUsedMeters)
                : null,
            startDate: parsed.data.startDate,
            targetFinishDate: parsed.data.targetFinishDate,
            targetQty,
            status: "planned",
            notes: parsed.data.notes || null,
            createdBy: actorId,
          })
          .returning({ id: productionBatches.id });

        newId = batch.id;

        await tx.insert(productionBatchProducts).values(
          parsed.data.products.map((p) => ({
            batchId: batch.id,
            productId: p.productId,
            qty: p.qty,
          }))
        );

        await tx.insert(productionBatchCostItems).values(
          parsed.data.costItems.map((c) => ({
            batchId: batch.id,
            costComponentId: c.costComponentId || null,
            label: c.label,
            qty: c.qty !== undefined ? String(c.qty) : null,
            unitCost: c.unitCost !== undefined ? String(c.unitCost) : null,
            subtotal: String(c.subtotal),
            isAdditional: c.isAdditional,
          }))
        );

        await tx.insert(tailorPayments).values({
          batchId: batch.id,
          terminNo: 1,
          amount: String(termin1Amount),
          dueDate: parsed.data.targetFinishDate,
          status: "due",
        });
      }
    );
  } catch {
    return { error: "Gagal menyimpan batch produksi" };
  }

  revalidatePath("/production");
  redirect(`/production/${newId}`);
}

export async function finishBatch(batchId: string, formData: FormData) {
  const parsed = finishBatchSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "production_batch", entityId: batchId, action: "update", actorId },
      async (tx) => {
        const costItemRows = await tx
          .select({ subtotal: productionBatchCostItems.subtotal })
          .from(productionBatchCostItems)
          .where(eq(productionBatchCostItems.batchId, batchId));

        const estimatedTotalCost = costItemRows.reduce((sum, c) => sum + Number(c.subtotal), 0);

        const existingPayments = await tx
          .select()
          .from(tailorPayments)
          .where(eq(tailorPayments.batchId, batchId));

        const termin1 = existingPayments.find((p) => p.terminNo === 1);
        const termin1Amount = Number(termin1?.amount ?? 0);

        await tx
          .update(productionBatches)
          .set({
            status: "finished",
            actualFinishDate: parsed.data.actualFinishDate,
            actualQty: parsed.data.actualQty,
            hppPerUnitCalc: String(Math.round(estimatedTotalCost / parsed.data.actualQty)),
            updatedAt: new Date(),
          })
          .where(eq(productionBatches.id, batchId));

        const alreadyHasTermin2 = existingPayments.some((p) => p.terminNo === 2);

        if (!alreadyHasTermin2) {
          const termin2Amount = Math.max(estimatedTotalCost - termin1Amount, 0);
          await tx.insert(tailorPayments).values({
            batchId,
            terminNo: 2,
            amount: String(termin2Amount),
            dueDate: parsed.data.actualFinishDate,
            status: "due",
          });
        }
      }
    );
  } catch {
    return { error: "Gagal menandai batch selesai" };
  }

  revalidatePath(`/production/${batchId}`);
  revalidatePath("/production");
  return { success: true };
}

export async function payTailorTermin(paymentId: string, batchId: string, formData: FormData) {
  const parsed = payTerminSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();

  try {
    await db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(tailorPayments)
        .where(eq(tailorPayments.id, paymentId));

      if (!payment) throw new Error("Termin tidak ditemukan");
      if (payment.status === "paid") throw new Error("Termin ini sudah dibayar");

      const earlierUnpaid = await tx
        .select({ terminNo: tailorPayments.terminNo })
        .from(tailorPayments)
        .where(
          and(
            eq(tailorPayments.batchId, batchId),
            lt(tailorPayments.terminNo, payment.terminNo),
            ne(tailorPayments.status, "paid")
          )
        );
      if (earlierUnpaid.length > 0) {
        throw new Error(
          `Termin ${Math.min(...earlierUnpaid.map((p) => p.terminNo))} harus dibayar dulu sebelum Termin ${payment.terminNo}`
        );
      }

      await tx
        .update(tailorPayments)
        .set({
          status: "paid",
          paidDate: parsed.data.paidDate,
          method: parsed.data.method,
        })
        .where(eq(tailorPayments.id, paymentId));

      await tx.insert(cashTransactions).values({
        txnDate: parsed.data.paidDate,
        accountId: parsed.data.accountId,
        direction: "out",
        amount: payment.amount,
        relatedType: "tailor_payment",
        relatedId: paymentId,
        description: `Pembayaran termin ${payment.terminNo} penjahit`,
        createdBy: actorId,
      });

      await writeAuditLog(tx, {
        entityType: "tailor_payment",
        entityId: paymentId,
        action: "update",
        actorId,
      });
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal mencatat pembayaran termin" };
  }

  revalidatePath(`/production/${batchId}`);
  revalidatePath("/cash-flow");
  return { success: true };
}

/**
 * Lets the user directly define a termin's Rp amount (not just derive it
 * from the tailor's default %). If Termin 1 is edited and Termin 2 already
 * exists but hasn't been paid yet, Termin 2 is auto-recalculated as the
 * remainder (total biaya − Termin 1) so the two always add up.
 */
export async function editTerminAmount(paymentId: string, batchId: string, formData: FormData) {
  const parsed = editTerminAmountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "tailor_payment", entityId: paymentId, action: "update", actorId },
      async (tx) => {
        const [payment] = await tx
          .select()
          .from(tailorPayments)
          .where(eq(tailorPayments.id, paymentId));

        if (!payment) throw new Error("Termin tidak ditemukan");
        if (payment.status === "paid") {
          throw new Error("Termin yang sudah dibayar tidak bisa diubah nominalnya");
        }

        await tx
          .update(tailorPayments)
          .set({ amount: String(parsed.data.amount) })
          .where(eq(tailorPayments.id, paymentId));

        if (payment.terminNo === 1) {
          const [termin2] = await tx
            .select()
            .from(tailorPayments)
            .where(and(eq(tailorPayments.batchId, batchId), eq(tailorPayments.terminNo, 2)));

          if (termin2 && termin2.status !== "paid") {
            const costItemRows = await tx
              .select({ subtotal: productionBatchCostItems.subtotal })
              .from(productionBatchCostItems)
              .where(eq(productionBatchCostItems.batchId, batchId));
            const totalCost = costItemRows.reduce((sum, c) => sum + Number(c.subtotal), 0);
            const termin2Amount = Math.max(totalCost - parsed.data.amount, 0);

            await tx
              .update(tailorPayments)
              .set({ amount: String(termin2Amount) })
              .where(eq(tailorPayments.id, termin2.id));
          }
        }
      }
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal mengubah nominal termin" };
  }

  revalidatePath(`/production/${batchId}`);
  return { success: true };
}
