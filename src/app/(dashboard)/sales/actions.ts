"use server";

import { and, eq, inArray } from "drizzle-orm";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, withTransaction } from "@/db";
import { salesEntries, salesLiveSessions, channels, payoutSalesLink } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { lockedMonthError } from "@/lib/month-lock";
import { todayJakarta } from "@/lib/period";
import { recordSaleOut, restockWholeRowReturn, reverseSaleOut } from "@/lib/stock";
import { withAudit, writeAuditLog } from "@/lib/audit";
import {
  manualSaleSchema,
  liveSessionSchema,
  csvImportSchema,
  posOrderSchema,
} from "@/lib/validators/sales";

async function getChannel(channelId: string) {
  const [channel] = await db
    .select({ defaultFeePct: channels.defaultFeePct, name: channels.name })
    .from(channels)
    .where(eq(channels.id, channelId));
  return {
    feePct: Number(channel?.defaultFeePct ?? 0),
    name: channel?.name ?? "",
  };
}

export async function createManualSale(formData: FormData) {
  const parsed = manualSaleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  const lock = await lockedMonthError([parsed.data.entryDate], "penjualan manual");
  if (lock) return { error: lock };
  const channel = await getChannel(parsed.data.channelId);
  const platformFeeEst = Math.round((parsed.data.grossAmount * channel.feePct) / 100);
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
        await recordSaleOut(
          tx,
          [{ id: inserted.id, productId: parsed.data.productId, qty: parsed.data.qty, entryDate: parsed.data.entryDate }],
          actorId
        );
      }
    );
  } catch {
    return { error: "Gagal menyimpan penjualan" };
  }

  revalidatePath("/sales");
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
  const lock = await lockedMonthError([parsed.data.sessionDate], "rekap live");
  if (lock) return { error: lock };
  const channel = await getChannel(parsed.data.channelId);
  const totalGross = parsed.data.entries.reduce((sum, e) => sum + e.qty * e.unitPrice, 0);
  let newSessionId = "";

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

        const insertedEntries = await tx.insert(salesEntries).values(
          parsed.data.entries.map((e) => {
            const gross = e.qty * e.unitPrice;
            const fee = Math.round((gross * channel.feePct) / 100);
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
        ).returning({ id: salesEntries.id, productId: salesEntries.productId, qty: salesEntries.qty });
        await recordSaleOut(
          tx,
          insertedEntries.map((e) => ({ ...e, entryDate: parsed.data.sessionDate })),
          actorId
        );
      }
    );
  } catch {
    return { error: "Gagal menyimpan rekap live" };
  }

  revalidatePath("/sales");
  redirect("/sales");
}

/** Rekap Live totals already recorded for the given days on a channel (for the import overlap warning). */
export async function getLiveOverlap(channelId: string, dates: string[]) {
  if (!channelId || dates.length === 0) return [];
  const rows = await db
    .select({ date: salesEntries.entryDate, qty: salesEntries.qty, gross: salesEntries.grossAmount })
    .from(salesEntries)
    .where(
      and(
        eq(salesEntries.channelId, channelId),
        eq(salesEntries.source, "live_bulk"),
        eq(salesEntries.isDeleted, false),
        eq(salesEntries.isReturned, false),
        inArray(salesEntries.entryDate, dates.slice(0, 400))
      )
    );
  const byDate = new Map<string, { date: string; rows: number; qty: number; gross: number }>();
  for (const r of rows) {
    const d = byDate.get(r.date) ?? { date: r.date, rows: 0, qty: 0, gross: 0 };
    d.rows += 1;
    d.qty += r.qty;
    d.gross += Number(r.gross);
    byDate.set(r.date, d);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
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
  const lock = await lockedMonthError(parsed.data.rows.map((r) => r.entryDate), "impor penjualan");
  if (lock) return { error: lock };
  const channel = await getChannel(parsed.data.channelId);

  let replaceLiveDates: string[] = [];
  try {
    const parsedDates = JSON.parse(String(raw.replaceLiveDates ?? "[]"));
    if (Array.isArray(parsedDates)) replaceLiveDates = parsedDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  } catch {}

  let insertedCount = 0;

  try {
    await withTransaction(async (tx) => {
      // "Ganti rekap live": cancel the day's live totals (and put their stock back) before the
      // per-order rows go in, so the same sales are not counted twice.
      if (replaceLiveDates.length > 0) {
        const live = await tx
          .select({ id: salesEntries.id, date: salesEntries.entryDate })
          .from(salesEntries)
          .where(
            and(
              eq(salesEntries.channelId, parsed.data.channelId),
              eq(salesEntries.source, "live_bulk"),
              eq(salesEntries.isDeleted, false),
              inArray(salesEntries.entryDate, replaceLiveDates)
            )
          );
        if (live.length > 0) {
          const t = tx as unknown as typeof db;
          await assertNotReconciled(t, live.map((l) => l.id));
          await t.update(salesEntries).set({ isDeleted: true }).where(inArray(salesEntries.id, live.map((l) => l.id)));
          await reverseSaleOut(t, live.map((l) => l.id), todayJakarta(), actorId);
          for (const l of live) {
            await writeAuditLog(t, {
              entityType: "sales_entry",
              entityId: l.id,
              action: "delete",
              actorId,
              diff: { reason: "diganti impor per-order", date: l.date },
            });
          }
        }
      }

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
            target: [salesEntries.channelId, salesEntries.orderRef, salesEntries.productId],
          })
          .returning({ id: salesEntries.id });

        if (result.length > 0) {
          insertedCount += 1;
          await recordSaleOut(
            tx,
            [{ id: result[0].id, productId: row.productId, qty: row.qty, entryDate: row.entryDate }],
            actorId
          );
        }
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
  const lock = await lockedMonthError([todayJakarta()], "kasir POS");
  if (lock) return { error: lock };
  const channel = await getChannel(parsed.data.channelId);
  const today = todayJakarta();
  const orderRef = `POS-${format(new Date(), "yyyyMMdd-HHmmss-SSS")}`;

  let firstEntryId = "";

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
          .returning({ id: salesEntries.id, productId: salesEntries.productId, qty: salesEntries.qty });

        firstEntryId = inserted[0].id;
        await recordSaleOut(
          tx,
          inserted.map((e) => ({ ...e, entryDate: today })),
          actorId
        );
      }
    );
  } catch {
    return { error: "Gagal menyimpan order" };
  }

  revalidatePath("/sales");
  revalidatePath("/sales/new/pos");
  return { success: true, orderRef };
}

async function assertNotReconciled(tx: typeof db, ids: string[]) {
  if (ids.length === 0) return;
  const linked = await tx
    .select({ id: payoutSalesLink.salesEntryId })
    .from(payoutSalesLink)
    .where(inArray(payoutSalesLink.salesEntryId, ids));
  if (linked.length > 0) {
    throw new Error("Order ini sudah termasuk dalam pencairan dana lama, tidak bisa dibatalkan");
  }
}

export async function cancelSalesEntry(id: string) {
  const actorId = await getCurrentUserId();
  const [lockRow] = await db.select({ d: salesEntries.entryDate }).from(salesEntries).where(eq(salesEntries.id, id));
  const lock = await lockedMonthError([lockRow?.d], "batalkan penjualan");
  if (lock) return { error: lock };

  try {
    await withAudit(
      { entityType: "sales_entry", entityId: id, action: "delete", actorId },
      async (tx) => {
        await assertNotReconciled(tx, [id]);
        await tx.update(salesEntries).set({ isDeleted: true }).where(eq(salesEntries.id, id));
        await reverseSaleOut(tx, [id], format(new Date(), "yyyy-MM-dd"), actorId);
      }
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal membatalkan penjualan" };
  }

  revalidatePath("/sales");
  revalidatePath("/sales/new/pos");
  return { success: true };
}

/**
 * Distinct from cancelSalesEntry: a retur is a post-delivery return of a
 * legitimately fulfilled order (barang sampai, lalu dikembalikan) — not a
 * pre-fulfillment mistake. Excluded from revenue/profit the same way, but
 * tracked separately since it means something different to the business.
 * See CLAUDE.md §6.3.
 */
export async function returnSalesEntry(id: string, formData: FormData) {
  const note = String(formData.get("note") ?? "").trim();
  const actorId = await getCurrentUserId();
  const [lockRow] = await db.select({ d: salesEntries.entryDate }).from(salesEntries).where(eq(salesEntries.id, id));
  const lock = await lockedMonthError([lockRow?.d], "retur penjualan");
  if (lock) return { error: lock };

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
        if (formData.get("restock") === "on") {
          await restockWholeRowReturn(tx, id, format(new Date(), "yyyy-MM-dd"), actorId);
        }
      }
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menandai retur" };
  }

  revalidatePath("/sales");
  revalidatePath("/reports");
  return { success: true };
}

export async function cancelPosOrder(orderRef: string) {
  const actorId = await getCurrentUserId();
  const lockRows = await db.select({ d: salesEntries.entryDate }).from(salesEntries).where(eq(salesEntries.orderRef, orderRef));
  const lock = await lockedMonthError(lockRows.map((r) => r.d), "batalkan order POS");
  if (lock) return { error: lock };
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
        await reverseSaleOut(tx, rows.map((r) => r.id), format(new Date(), "yyyy-MM-dd"), actorId);
      }
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal membatalkan order" };
  }

  revalidatePath("/sales");
  revalidatePath("/sales/new/pos");
  return { success: true };
}
