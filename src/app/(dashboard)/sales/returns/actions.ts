"use server";

import { z } from "zod";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, withTransaction } from "@/db";
import { productAliases, products, salesEntries, salesReturns } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { todayJakarta } from "@/lib/period";
import { syncReturnStock } from "@/lib/stock";

const importSchema = z.object({
  channelId: z.string().uuid("Pilih channel"),
  restock: z.boolean(),
  rows: z
    .array(
      z.object({
        externalReturnId: z.string().min(1),
        externalOrderId: z.string(),
        requestedAt: z.string().min(1),
        refundedAt: z.string().nullable(),
        qty: z.number().int().min(1),
        refundAmount: z.number().positive(),
        status: z.enum(["processing", "completed", "rejected"]),
        reason: z.string().nullable(),
        buyerNote: z.string().nullable(),
        productName: z.string().nullable(),
        productId: z.string().uuid(),
      })
    )
    .min(1, "Tidak ada baris valid untuk diimpor"),
});

/** Upsert by externalReturnId; idempotent, stock effect follows each return's status. */
export async function importTikTokReturns(payload: z.input<typeof importSchema>) {
  const parsed = importSchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const { channelId, restock, rows } = parsed.data;
  const actorId = await getCurrentUserId();
  const today = todayJakarta();
  let inserted = 0;
  let updated = 0;

  try {
    await withTransaction(async (tx) => {
      const t = tx as unknown as typeof db;
      const hpp = new Map(
        (
          await t
            .select({ id: products.id, hpp: products.hppTarget })
            .from(products)
            .where(inArray(products.id, [...new Set(rows.map((r) => r.productId))]))
        ).map((p) => [p.id, Number(p.hpp ?? 0)])
      );

      for (const r of rows) {
        const [existing] = await t
          .select({ id: salesReturns.id, restock: salesReturns.restock })
          .from(salesReturns)
          .where(eq(salesReturns.externalReturnId, r.externalReturnId));

        let id: string;
        let useRestock = restock;
        if (existing) {
          id = existing.id;
          useRestock = existing.restock;
          await t
            .update(salesReturns)
            .set({
              status: r.status,
              refundedAt: r.refundedAt ? new Date(r.refundedAt) : null,
              qty: r.qty,
              refundAmount: String(r.refundAmount),
              reason: r.reason,
              buyerNote: r.buyerNote,
              isDeleted: false,
            })
            .where(eq(salesReturns.id, id));
          updated += 1;
        } else {
          const [match] = r.externalOrderId
            ? await t
                .select({ id: salesEntries.id })
                .from(salesEntries)
                .where(
                  and(
                    eq(salesEntries.channelId, channelId),
                    eq(salesEntries.orderRef, r.externalOrderId),
                    eq(salesEntries.productId, r.productId)
                  )
                )
                .limit(1)
            : [];
          const [created] = await t
            .insert(salesReturns)
            .values({
              salesEntryId: match?.id ?? null,
              channelId,
              productId: r.productId,
              externalReturnId: r.externalReturnId,
              externalOrderId: r.externalOrderId || null,
              requestedAt: new Date(r.requestedAt),
              refundedAt: r.refundedAt ? new Date(r.refundedAt) : null,
              qty: r.qty,
              refundAmount: String(r.refundAmount),
              hppPerUnit: String(hpp.get(r.productId) ?? 0),
              restock,
              status: r.status,
              reason: r.reason,
              buyerNote: r.buyerNote,
              source: "tiktok_import",
              createdBy: actorId,
            })
            .returning({ id: salesReturns.id });
          id = created.id;
          inserted += 1;
        }

        if (r.productName) {
          await t
            .insert(productAliases)
            .values({ productId: r.productId, alias: r.productName })
            .onConflictDoNothing();
        }

        await syncReturnStock(
          t,
          { id, productId: r.productId, qty: r.qty, restock: useRestock, status: r.status, isDeleted: false },
          today,
          actorId
        );
      }
    });
  } catch {
    return { error: "Gagal mengimpor retur" };
  }

  revalidatePath("/sales");
  revalidatePath("/stock");
  revalidatePath("/reports");
  revalidatePath("/");
  return { success: true, inserted, updated };
}

const partialSchema = z.object({
  qty: z.coerce.number().int("Jumlah harus bilangan bulat").min(1, "Jumlah minimal 1"),
  refundAmount: z.coerce.number().min(0, "Nominal refund tidak valid").max(999_999_999),
  reason: z.string().optional(),
  restock: z.string().optional(),
});

/** "Retur sebagian": records part of an order row as returned (qty ≤ row qty minus earlier returns). */
export async function createPartialReturn(entryId: string, formData: FormData) {
  const parsed = partialSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const d = parsed.data;
  const actorId = await getCurrentUserId();
  let newId = "";

  try {
    await withAudit(
      { entityType: "sales_return", entityId: () => newId, action: "create", actorId, diff: { entryId, ...d } },
      async (tx) => {
        const [entry] = await tx
          .select()
          .from(salesEntries)
          .where(eq(salesEntries.id, entryId));
        if (!entry) throw new Error("Penjualan tidak ditemukan");
        if (entry.isDeleted) throw new Error("Order yang dibatalkan tidak bisa diretur");
        if (entry.isReturned) throw new Error("Order ini sudah ditandai retur penuh");

        const [already] = await tx
          .select({ qty: sql<number>`coalesce(sum(${salesReturns.qty}), 0)::int` })
          .from(salesReturns)
          .where(
            and(
              eq(salesReturns.salesEntryId, entryId),
              eq(salesReturns.isDeleted, false),
              ne(salesReturns.status, "rejected")
            )
          );
        const left = entry.qty - (already?.qty ?? 0);
        if (d.qty > left) throw new Error(`Jumlah retur melebihi sisa (${left} pcs)`);

        const [product] = entry.productId
          ? await tx
              .select({ hpp: products.hppTarget })
              .from(products)
              .where(eq(products.id, entry.productId))
          : [];

        const restock = d.restock === "on";
        const [created] = await tx
          .insert(salesReturns)
          .values({
            salesEntryId: entryId,
            channelId: entry.channelId,
            productId: entry.productId,
            requestedAt: new Date(),
            refundedAt: new Date(),
            qty: d.qty,
            refundAmount: String(d.refundAmount),
            hppPerUnit: String(Number(product?.hpp ?? 0)),
            restock,
            status: "completed",
            reason: d.reason?.trim() || null,
            source: "manual",
            createdBy: actorId,
          })
          .returning({ id: salesReturns.id });
        newId = created.id;

        await syncReturnStock(
          tx,
          { id: created.id, productId: entry.productId, qty: d.qty, restock, status: "completed", isDeleted: false },
          todayJakarta(),
          actorId
        );
      }
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menyimpan retur" };
  }

  revalidatePath("/sales");
  revalidatePath(`/sales/${entryId}`);
  revalidatePath("/stock");
  revalidatePath("/reports");
  return { success: true };
}

/** Soft-deletes a manual return (imports are managed by re-importing). */
export async function deleteSalesReturn(id: string) {
  const actorId = await getCurrentUserId();
  try {
    await withAudit({ entityType: "sales_return", entityId: id, action: "delete", actorId }, async (tx) => {
      const [ret] = await tx.select().from(salesReturns).where(eq(salesReturns.id, id));
      if (!ret) throw new Error("Retur tidak ditemukan");
      if (ret.source !== "manual") throw new Error("Retur hasil impor tidak bisa dihapus manual");
      await tx.update(salesReturns).set({ isDeleted: true }).where(eq(salesReturns.id, id));
      await syncReturnStock(
        tx,
        { id, productId: ret.productId, qty: ret.qty, restock: ret.restock, status: ret.status, isDeleted: true },
        todayJakarta(),
        actorId
      );
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menghapus retur" };
  }
  revalidatePath("/sales");
  revalidatePath("/stock");
  revalidatePath("/reports");
  return { success: true };
}
