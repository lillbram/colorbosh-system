"use server";

import { and, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, withTransaction } from "@/db";
import {
  purchaseOrders,
  purchaseOrderItems,
  purchaseOrderPayments,
  cashTransactions,
} from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit, writeAuditLog } from "@/lib/audit";
import {
  purchaseOrderSchema,
  poPaymentSchema,
  receiveGoodsSchema,
} from "@/lib/validators/purchase-order";

async function generatePoNumber() {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(purchaseOrders)
    .where(gte(purchaseOrders.createdAt, startOfDay));

  return `PO-${datePart}-${String(count + 1).padStart(3, "0")}`;
}

export async function createPurchaseOrder(formData: FormData) {
  const raw = Object.fromEntries(formData);
  let items: unknown;
  try {
    items = JSON.parse(String(raw.itemsJson ?? "[]"));
  } catch {
    return { error: "Data item tidak valid" };
  }

  const parsed = purchaseOrderSchema.safeParse({ ...raw, items });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  const poNumber = await generatePoNumber();
  const totalAmount = parsed.data.items.reduce(
    (sum, item) => sum + item.qtyOrdered * item.unitPrice,
    0
  );

  let newId = "";

  try {
    await withAudit(
      { entityType: "purchase_order", entityId: () => newId, action: "create", actorId },
      async (tx) => {
        const [po] = await tx
          .insert(purchaseOrders)
          .values({
            supplierId: parsed.data.supplierId,
            poNumber,
            orderDate: parsed.data.orderDate,
            expectedDate: parsed.data.expectedDate || null,
            status: "ordered",
            totalAmount: String(totalAmount),
            notes: parsed.data.notes || null,
            createdBy: actorId,
          })
          .returning({ id: purchaseOrders.id });

        newId = po.id;

        await tx.insert(purchaseOrderItems).values(
          parsed.data.items.map((item) => ({
            poId: po.id,
            itemType: item.itemType,
            description: item.description,
            qtyOrdered: String(item.qtyOrdered),
            unit: item.unit,
            unitPrice: String(item.unitPrice),
          }))
        );
      }
    );
  } catch {
    return { error: "Gagal menyimpan pemesanan kain" };
  }

  revalidatePath("/procurement");
  redirect(`/procurement/${newId}`);
}

export async function receiveGoods(poId: string, formData: FormData) {
  const raw = Object.fromEntries(formData);
  let items: unknown;
  try {
    items = JSON.parse(String(raw.itemsJson ?? "[]"));
  } catch {
    return { error: "Data item tidak valid" };
  }

  const parsed = receiveGoodsSchema.safeParse({ ...raw, items });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "purchase_order", entityId: poId, action: "update", actorId },
      async (tx) => {
        for (const item of parsed.data.items) {
          await tx
            .update(purchaseOrderItems)
            .set({ qtyReceived: String(item.qtyReceived) })
            .where(eq(purchaseOrderItems.id, item.id));
        }

        const allItems = await tx
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.poId, poId));

        const fullyReceived = allItems.every(
          (i) => Number(i.qtyReceived ?? 0) >= Number(i.qtyOrdered)
        );

        await tx
          .update(purchaseOrders)
          .set({
            status: fullyReceived ? "received" : "partially_received",
            actualArrivalDate: parsed.data.actualArrivalDate,
            updatedAt: new Date(),
          })
          .where(eq(purchaseOrders.id, poId));
      }
    );
  } catch {
    return { error: "Gagal mencatat penerimaan kain" };
  }

  revalidatePath(`/procurement/${poId}`);
  revalidatePath("/procurement");
  return { success: true };
}

export async function addPoPayment(poId: string, formData: FormData) {
  const parsed = poPaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();

  try {
    await withTransaction(async (tx) => {
      const [payment] = await tx
        .insert(purchaseOrderPayments)
        .values({
          poId,
          amount: String(parsed.data.amount),
          paymentDate: parsed.data.paymentDate,
          method: parsed.data.method,
          notes: parsed.data.notes || null,
          createdBy: actorId,
        })
        .returning({ id: purchaseOrderPayments.id });

      await tx.insert(cashTransactions).values({
        txnDate: parsed.data.paymentDate,
        accountId: parsed.data.accountId,
        direction: "out",
        amount: String(parsed.data.amount),
        relatedType: "po_payment",
        relatedId: poId,
        description: `Pembayaran pemesanan kain`,
        createdBy: actorId,
      });

      await writeAuditLog(tx, {
        entityType: "purchase_order_payment",
        entityId: payment.id,
        action: "create",
        actorId,
      });
    });
  } catch {
    return { error: "Gagal mencatat pembayaran" };
  }

  revalidatePath(`/procurement/${poId}`);
  revalidatePath("/cash-flow");
  return { success: true };
}

export async function cancelPurchaseOrder(poId: string) {
  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "purchase_order", entityId: poId, action: "update", actorId },
      async (tx) => {
        await tx
          .update(purchaseOrders)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(and(eq(purchaseOrders.id, poId)));
      }
    );
  } catch {
    return { error: "Gagal membatalkan pemesanan" };
  }

  revalidatePath(`/procurement/${poId}`);
  revalidatePath("/procurement");
  return { success: true };
}
