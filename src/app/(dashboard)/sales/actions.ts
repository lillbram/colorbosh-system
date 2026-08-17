"use server";

import { eq, inArray } from "drizzle-orm";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, withTransaction } from "@/db";
import { salesEntries, salesLiveSessions, channels, payoutSalesLink, cashTransactions } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import {
  manualSaleSchema,
  liveSessionSchema,
  csvImportSchema,
  posOrderSchema,
} from "@/lib/validators/sales";

async function getChannel(channelId: string) {
  const [channel] = await db
    .select({ defaultFeePct: channels.defaultFeePct, requiresDisbursement: channels.requiresDisbursement, name: channels.name })
    .from(channels)
    .where(eq(channels.id, channelId));
  return {
    feePct: Number(channel?.defaultFeePct ?? 0),
    requiresDisbursement: channel?.requiresDisbursement ?? true,
    name: channel?.name ?? "",
  };
}

/**
 * For channels where money is received directly at sale time (requiresDisbursement
 * = false, e.g. "Paket Usaha") — posts a matching cash_transaction immediately
 * instead of waiting for a Pencairan Dana payout that will never come. See §6.4.
 */
async function postDirectSettlementCash(
  tx: typeof db,
  params: { accountId: string; amount: number; txnDate: string; channelName: string; createdBy: string | null }
) {
  await tx.insert(cashTransactions).values({
    txnDate: params.txnDate,
    accountId: params.accountId,
    direction: "in",
    amount: String(params.amount),
    relatedType: "manual",
    description: `Penjualan langsung - ${params.channelName}`,
    createdBy: params.createdBy,
  });
}

export async function createManualSale(formData: FormData) {
  const parsed = manualSaleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  const channel = await getChannel(parsed.data.channelId);
  if (!channel.requiresDisbursement && !parsed.data.accountId) {
    return { error: "Pilih akun tujuan — channel ini uangnya diterima langsung" };
  }
  const platformFeeEst = Math.round((parsed.data.grossAmount * channel.feePct) / 100);
  const netExpected = parsed.data.grossAmount - platformFeeEst - parsed.data.discount;
  let newId = "";

  try {
    await withAudit(
      { entityType: "sales_entry", entityId: () => newId, action: "create", actorId },
      async (tx) => {
        const [inserted] = await tx
          .insert(salesEntries)
          .values({
            entryDate: parsed.data.entryDate,
            channelId: parsed.data.channelId,
            productId: parsed.data.productId,
            qty: parsed.data.qty,
            grossAmount: String(parsed.data.grossAmount),
            platformFeeEst: String(platformFeeEst),
            discount: String(parsed.data.discount),
            orderRef: parsed.data.orderRef || null,
            buyerNote: parsed.data.buyerNote || null,
            source: "manual",
            createdBy: actorId,
          })
          .returning({ id: salesEntries.id });
        newId = inserted.id;

        if (!channel.requiresDisbursement && parsed.data.accountId) {
          await postDirectSettlementCash(tx, {
            accountId: parsed.data.accountId,
            amount: netExpected,
            txnDate: parsed.data.entryDate,
            channelName: channel.name,
            createdBy: actorId,
          });
        }
      }
    );
  } catch {
    return { error: "Gagal menyimpan penjualan" };
  }

  revalidatePath("/sales");
  revalidatePath("/cash-flow");
  return { success: true };
}

export async function createLiveSession(formData: FormData) {
  const raw = Object.fromEntries(formData);
  let entries: unknown;
  try {
    entries = JSON.parse(String(raw.entriesJson ?? "[]"));
  } catch {
    return { error: "Data produk tidak valid" };
  }

  const parsed = liveSessionSchema.safeParse({ ...raw, entries });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  const channel = await getChannel(parsed.data.channelId);
  if (!channel.requiresDisbursement && !parsed.data.accountId) {
    return { error: "Pilih akun tujuan — channel ini uangnya diterima langsung" };
  }
  const totalGross = parsed.data.entries.reduce((sum, e) => sum + e.qty * e.unitPrice, 0);
  let newSessionId = "";
  let totalNetExpected = 0;

  try {
    await withAudit(
      { entityType: "sales_live_session", entityId: () => newSessionId, action: "create", actorId },
      async (tx) => {
        const [session] = await tx
          .insert(salesLiveSessions)
          .values({
            sessionDate: parsed.data.sessionDate,
            channelId: parsed.data.channelId,
            hostName: parsed.data.hostName || null,
            totalOrders: parsed.data.entries.length,
            totalGross: String(totalGross),
            notes: parsed.data.notes || null,
            createdBy: actorId,
          })
          .returning({ id: salesLiveSessions.id });

        newSessionId = session.id;

        await tx.insert(salesEntries).values(
          parsed.data.entries.map((e) => {
            const gross = e.qty * e.unitPrice;
            const fee = Math.round((gross * channel.feePct) / 100);
            totalNetExpected += gross - fee;
            return {
              entryDate: parsed.data.sessionDate,
              channelId: parsed.data.channelId,
              productId: e.productId,
              qty: e.qty,
              grossAmount: String(gross),
              platformFeeEst: String(fee),
              source: "live_bulk" as const,
              liveSessionId: session.id,
              createdBy: actorId,
            };
          })
        );

        if (!channel.requiresDisbursement && parsed.data.accountId) {
          await postDirectSettlementCash(tx, {
            accountId: parsed.data.accountId,
            amount: totalNetExpected,
            txnDate: parsed.data.sessionDate,
            channelName: channel.name,
            createdBy: actorId,
          });
        }
      }
    );
  } catch {
    return { error: "Gagal menyimpan rekap live" };
  }

  revalidatePath("/sales");
  revalidatePath("/cash-flow");
  redirect("/sales");
}

export async function importSalesCsv(formData: FormData) {
  const raw = Object.fromEntries(formData);
  let rows: unknown;
  try {
    rows = JSON.parse(String(raw.rowsJson ?? "[]"));
  } catch {
    return { error: "Data CSV tidak valid" };
  }

  const parsed = csvImportSchema.safeParse({ ...raw, rows });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  const channel = await getChannel(parsed.data.channelId);

  let insertedCount = 0;

  try {
    await withTransaction(async (tx) => {
      for (const row of parsed.data.rows) {
        const platformFeeEst = Math.round((row.grossAmount * channel.feePct) / 100);
        const result = await tx
          .insert(salesEntries)
          .values({
            entryDate: row.entryDate,
            channelId: parsed.data.channelId,
            productId: row.productId,
            qty: row.qty,
            grossAmount: String(row.grossAmount),
            platformFeeEst: String(platformFeeEst),
            orderRef: row.orderRef,
            source: "csv_import",
            createdBy: actorId,
          })
          .onConflictDoNothing({
            target: [salesEntries.channelId, salesEntries.orderRef],
          })
          .returning({ id: salesEntries.id });

        if (result.length > 0) insertedCount += 1;
      }
    });
  } catch {
    return { error: "Gagal mengimpor data penjualan" };
  }

  revalidatePath("/sales");
  return { success: true, insertedCount, skipped: parsed.data.rows.length - insertedCount };
}

export async function createPosOrder(formData: FormData) {
  const raw = Object.fromEntries(formData);
  let items: unknown;
  try {
    items = JSON.parse(String(raw.itemsJson ?? "[]"));
  } catch {
    return { error: "Data keranjang tidak valid" };
  }

  const parsed = posOrderSchema.safeParse({ ...raw, items });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  const channel = await getChannel(parsed.data.channelId);
  if (!channel.requiresDisbursement && !parsed.data.accountId) {
    return { error: "Pilih akun tujuan — channel ini uangnya diterima langsung" };
  }
  const today = format(new Date(), "yyyy-MM-dd");
  const orderRef = `POS-${format(new Date(), "yyyyMMdd-HHmmss-SSS")}`;

  let firstEntryId = "";
  let totalNetExpected = 0;

  try {
    await withAudit(
      { entityType: "sales_entry", entityId: () => firstEntryId, action: "create", actorId },
      async (tx) => {
        const inserted = await tx
          .insert(salesEntries)
          .values(
            parsed.data.items.map((item) => {
              const gross = item.qty * item.unitPrice;
              const fee = Math.round((gross * channel.feePct) / 100);
              totalNetExpected += gross - fee;
              return {
                entryDate: today,
                channelId: parsed.data.channelId,
                productId: item.productId,
                qty: item.qty,
                grossAmount: String(gross),
                platformFeeEst: String(fee),
                orderRef,
                buyerNote: parsed.data.buyerNote || null,
                source: "pos" as const,
                createdBy: actorId,
              };
            })
          )
          .returning({ id: salesEntries.id });

        firstEntryId = inserted[0].id;

        if (!channel.requiresDisbursement && parsed.data.accountId) {
          await postDirectSettlementCash(tx, {
            accountId: parsed.data.accountId,
            amount: totalNetExpected,
            txnDate: today,
            channelName: channel.name,
            createdBy: actorId,
          });
        }
      }
    );
  } catch {
    return { error: "Gagal menyimpan order" };
  }

  revalidatePath("/sales");
  revalidatePath("/sales/new/pos");
  revalidatePath("/cash-flow");
  return { success: true, orderRef };
}

async function assertNotReconciled(tx: typeof db, ids: string[]) {
  if (ids.length === 0) return;
  const linked = await tx
    .select({ id: payoutSalesLink.salesEntryId })
    .from(payoutSalesLink)
    .where(inArray(payoutSalesLink.salesEntryId, ids));
  if (linked.length > 0) {
    throw new Error("Order ini sudah termasuk dalam pencairan dana, tidak bisa dibatalkan");
  }
}

export async function cancelSalesEntry(id: string) {
  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "sales_entry", entityId: id, action: "delete", actorId },
      async (tx) => {
        await assertNotReconciled(tx, [id]);
        await tx.update(salesEntries).set({ isDeleted: true }).where(eq(salesEntries.id, id));
      }
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal membatalkan penjualan" };
  }

  revalidatePath("/sales");
  revalidatePath("/sales/new/pos");
  revalidatePath("/disbursement");
  return { success: true };
}

/**
 * Distinct from cancelSalesEntry: a retur is a post-delivery return of a
 * legitimately fulfilled order (barang sampai, lalu dikembalikan) — not a
 * pre-fulfillment mistake. Excluded from revenue/stock/profit and
 * disbursement the same way, but tracked separately since it means
 * something different to the business. See CLAUDE.md §6.3.
 */
export async function returnSalesEntry(id: string, formData: FormData) {
  const note = String(formData.get("note") ?? "").trim();
  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "sales_entry", entityId: id, action: "update", actorId },
      async (tx) => {
        const [entry] = await tx
          .select({ isDeleted: salesEntries.isDeleted, isReturned: salesEntries.isReturned })
          .from(salesEntries)
          .where(eq(salesEntries.id, id));
        if (!entry) throw new Error("Penjualan tidak ditemukan");
        if (entry.isDeleted) throw new Error("Order yang sudah dibatalkan tidak bisa ditandai retur");
        if (entry.isReturned) throw new Error("Order ini sudah ditandai retur");

        await assertNotReconciled(tx, [id]);
        await tx
          .update(salesEntries)
          .set({ isReturned: true, returnedAt: new Date(), returnNote: note || null })
          .where(eq(salesEntries.id, id));
      }
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menandai retur" };
  }

  revalidatePath("/sales");
  revalidatePath("/disbursement");
  revalidatePath("/reports");
  return { success: true };
}

export async function cancelPosOrder(orderRef: string) {
  const actorId = await getCurrentUserId();
  let firstEntryId = "";

  try {
    await withAudit(
      { entityType: "sales_entry", entityId: () => firstEntryId, action: "delete", actorId },
      async (tx) => {
        const rows = await tx
          .select({ id: salesEntries.id })
          .from(salesEntries)
          .where(eq(salesEntries.orderRef, orderRef));
        if (rows.length === 0) throw new Error("Order tidak ditemukan");
        firstEntryId = rows[0].id;
        await assertNotReconciled(tx, rows.map((r) => r.id));
        await tx.update(salesEntries).set({ isDeleted: true }).where(eq(salesEntries.orderRef, orderRef));
      }
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal membatalkan order" };
  }

  revalidatePath("/sales");
  revalidatePath("/sales/new/pos");
  revalidatePath("/disbursement");
  return { success: true };
}
