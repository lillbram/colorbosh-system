"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { products, stockMovements } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { getProductStock, writeStockMovements } from "@/lib/stock";

const stockInSchema = z.object({
  productId: z.string().uuid("Pilih produk"),
  qty: z.coerce.number().int("Jumlah harus bilangan bulat").min(1, "Jumlah minimal 1").max(100_000),
  movementDate: z.string().min(1, "Tanggal wajib diisi"),
  note: z.string().optional(),
  cashTransactionId: z.string().uuid().optional().or(z.literal("")),
});

/** Stok Masuk (production_in): finished goods arriving from the tailor. */
export async function addStockIn(formData: FormData) {
  const parsed = stockInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const d = parsed.data;
  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "stock_movement", entityId: d.productId, action: "create", actorId, diff: d },
      async (tx) => {
        await writeStockMovements(tx, [
          {
            productId: d.productId,
            movementDate: d.movementDate,
            type: "production_in",
            qty: d.qty,
            refType: d.cashTransactionId ? "cash_transaction" : undefined,
            refId: d.cashTransactionId || undefined,
            note: d.note?.trim() || undefined,
            createdBy: actorId,
          },
        ]);
      }
    );
  } catch {
    return { error: "Gagal mencatat stok masuk" };
  }

  revalidatePath("/stock");
  return { success: true };
}

/**
 * One-time opening balance per product. Writes `desired − current` so it
 * stays correct even if sales were already recorded since stock tracking
 * began (those sale_out rows are netted out).
 */
export async function setOpeningStock(productId: string, desiredQty: number, date: string) {
  if (!Number.isInteger(desiredQty) || desiredQty < 0) return { error: "Jumlah stok tidak valid" };
  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "stock_movement", entityId: productId, action: "create", actorId, diff: { opening: desiredQty } },
      async (tx) => {
        const [p] = await tx.select({ id: products.id }).from(products).where(eq(products.id, productId));
        if (!p) throw new Error("Produk tidak ditemukan");
        const [existing] = await tx
          .select({ id: stockMovements.id })
          .from(stockMovements)
          .where(and(eq(stockMovements.productId, productId), eq(stockMovements.type, "opening")))
          .limit(1);
        if (existing) throw new Error("Stok awal produk ini sudah diatur, pakai Stock Opname untuk koreksi");
        const current = await getProductStock(tx, productId);
        await writeStockMovements(tx, [
          {
            productId,
            movementDate: date,
            type: "opening",
            qty: desiredQty - current,
            note: "Stok awal",
            createdBy: actorId,
          },
        ]);
        // Zero delta still needs a marker so the product counts as "stok awal sudah diatur".
        if (desiredQty - current === 0) {
          await tx.insert(stockMovements).values({
            productId,
            movementDate: date,
            type: "opening",
            qty: 0,
            note: "Stok awal",
            createdBy: actorId,
          });
        }
      }
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menyimpan stok awal" };
  }

  revalidatePath("/stock");
  return { success: true };
}

const opnameSchema = z.object({
  date: z.string().min(1),
  counts: z.array(z.object({ productId: z.string().uuid(), physical: z.number().int().min(0) })).min(1),
});

/** Stock opname: write `opname` movements for every product whose physical count differs from the system. */
export async function confirmOpname(payload: { date: string; counts: { productId: string; physical: number }[] }) {
  const parsed = opnameSchema.safeParse(payload);
  if (!parsed.success) return { error: "Data opname tidak valid" };
  const actorId = await getCurrentUserId();
  let changed = 0;

  try {
    await withAudit(
      { entityType: "stock_opname", entityId: parsed.data.counts[0].productId, action: "create", actorId, diff: parsed.data },
      async (tx) => {
        const rows = [];
        for (const c of parsed.data.counts) {
          const diff = c.physical - (await getProductStock(tx, c.productId));
          if (diff !== 0) {
            rows.push({
              productId: c.productId,
              movementDate: parsed.data.date,
              type: "opname" as const,
              qty: diff,
              note: "Stock opname",
              createdBy: actorId,
            });
          }
        }
        changed = rows.length;
        await writeStockMovements(tx, rows);
      }
    );
  } catch {
    return { error: "Gagal menyimpan opname" };
  }

  revalidatePath("/stock");
  return { success: true, changed };
}
