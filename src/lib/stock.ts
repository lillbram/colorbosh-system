import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, settings, stockMovements } from "@/db/schema";

type Tx = typeof db;
type MovementType = (typeof stockMovements.$inferInsert)["type"];

export type NewMovement = {
  productId: string;
  movementDate: string;
  type: MovementType;
  /** Signed: negative = stock goes out. */
  qty: number;
  refType?: string;
  refId?: string;
  note?: string;
  createdBy?: string | null;
};

export async function writeStockMovements(tx: Tx, rows: NewMovement[]) {
  const valid = rows.filter((r) => r.qty !== 0);
  if (valid.length === 0) return;
  await tx.insert(stockMovements).values(
    valid.map((r) => ({
      productId: r.productId,
      movementDate: r.movementDate,
      type: r.type,
      qty: r.qty,
      refType: r.refType ?? null,
      refId: r.refId ?? null,
      note: r.note ?? null,
      createdBy: r.createdBy ?? null,
    }))
  );
}

/**
 * sale_out (negative) for freshly inserted sales rows. Rows without a product
 * are skipped. Stock never goes below 0: when a sale is larger than what is on
 * hand, only the available quantity is deducted (a later cancel puts back just
 * what was deducted).
 */
export async function recordSaleOut(
  tx: Tx,
  entries: { id: string; productId: string | null; qty: number; entryDate: string }[],
  actorId: string | null
) {
  const withProduct = entries.filter((e): e is typeof e & { productId: string } => !!e.productId);
  if (withProduct.length === 0) return;
  const ids = Array.from(new Set(withProduct.map((e) => e.productId)));
  const sums = await tx
    .select({ productId: stockMovements.productId, qty: sql<number>`coalesce(sum(${stockMovements.qty}), 0)::int` })
    .from(stockMovements)
    .where(inArray(stockMovements.productId, ids))
    .groupBy(stockMovements.productId);
  const available = new Map(sums.map((r) => [r.productId, Math.max(0, r.qty)]));

  const rows: NewMovement[] = [];
  for (const e of withProduct) {
    const have = available.get(e.productId) ?? 0;
    const take = Math.min(e.qty, have);
    available.set(e.productId, have - take);
    if (take <= 0) continue;
    rows.push({
      productId: e.productId,
      movementDate: e.entryDate,
      type: "sale_out",
      qty: -take,
      refType: "sales_entry",
      refId: e.id,
      note: take < e.qty ? `Stok tidak cukup: terjual ${e.qty}, stok berkurang ${take}` : undefined,
      createdBy: actorId,
    });
  }
  await writeStockMovements(tx, rows);
}

/**
 * Entries that already have a sale_out (rows created before stock tracking
 * have none) — so cancel/return never adds stock that was never deducted.
 */
async function entriesWithSaleOut(tx: Tx, entryIds: string[]) {
  if (entryIds.length === 0) return new Map<string, { productId: string; qty: number }>();
  const rows = await tx
    .select({
      refId: stockMovements.refId,
      productId: stockMovements.productId,
      qty: stockMovements.qty,
    })
    .from(stockMovements)
    .where(
      and(
        eq(stockMovements.refType, "sales_entry"),
        eq(stockMovements.type, "sale_out"),
        inArray(stockMovements.refId, entryIds)
      )
    );
  return new Map(rows.map((r) => [r.refId as string, { productId: r.productId, qty: -r.qty }]));
}

/** Puts stock back for cancelled sales rows (only those that had a sale_out). */
export async function reverseSaleOut(tx: Tx, entryIds: string[], date: string, actorId: string | null) {
  const had = await entriesWithSaleOut(tx, entryIds);
  await writeStockMovements(
    tx,
    Array.from(had.entries()).map(([id, m]) => ({
      productId: m.productId,
      movementDate: date,
      type: "adjustment" as const,
      qty: m.qty,
      refType: "sales_entry_cancel",
      refId: id,
      note: "Pembatalan penjualan",
      createdBy: actorId,
    }))
  );
}

/** return_in for a whole-row legacy return, only when the row had a sale_out. */
export async function restockWholeRowReturn(tx: Tx, entryId: string, date: string, actorId: string | null) {
  const had = await entriesWithSaleOut(tx, [entryId]);
  const m = had.get(entryId);
  if (!m) return;
  await writeStockMovements(tx, [
    {
      productId: m.productId,
      movementDate: date,
      type: "return_in",
      qty: m.qty,
      refType: "sales_entry_return",
      refId: entryId,
      createdBy: actorId,
    },
  ]);
}

export async function getLowStockThreshold(): Promise<number> {
  const [row] = await db.select({ t: settings.lowStockThreshold }).from(settings).where(eq(settings.id, 1));
  return row?.t ?? 10;
}

export type StockLevel = {
  productId: string;
  name: string;
  sku: string | null;
  hppTarget: number;
  qty: number;
  hasOpening: boolean;
  hasMovements: boolean;
};

/** Current stock for every active, non-deleted product (Σ signed movements). */
export async function getStockLevels(): Promise<StockLevel[]> {
  const rows = await db
    .select({
      productId: products.id,
      name: products.name,
      sku: products.sku,
      hppTarget: products.hppTarget,
      qty: sql<number>`coalesce(sum(${stockMovements.qty}), 0)::int`,
      openings: sql<number>`count(*) filter (where ${stockMovements.type} = 'opening')::int`,
      movements: sql<number>`count(${stockMovements.id})::int`,
    })
    .from(products)
    .leftJoin(stockMovements, eq(stockMovements.productId, products.id))
    .where(and(eq(products.isDeleted, false), eq(products.isActive, true)))
    .groupBy(products.id)
    .orderBy(products.name);

  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    sku: r.sku,
    hppTarget: Number(r.hppTarget ?? 0),
    qty: Math.max(0, r.qty),
    hasOpening: r.openings > 0,
    hasMovements: r.movements > 0,
  }));
}

export async function getProductStock(tx: Tx, productId: string): Promise<number> {
  const [row] = await tx
    .select({ qty: sql<number>`coalesce(sum(${stockMovements.qty}), 0)::int` })
    .from(stockMovements)
    .where(eq(stockMovements.productId, productId));
  return row?.qty ?? 0;
}

/**
 * Makes the stock effect of a sales_returns row match its state: +qty while it
 * is completed + restock + not deleted, otherwise 0. Idempotent — writes only
 * the delta against what is already booked for this return.
 */
export async function syncReturnStock(
  tx: Tx,
  ret: {
    id: string;
    productId: string | null;
    qty: number;
    restock: boolean;
    status: "processing" | "completed" | "rejected";
    isDeleted: boolean;
  },
  date: string,
  actorId: string | null
) {
  if (!ret.productId) return;
  const desired = ret.status === "completed" && ret.restock && !ret.isDeleted ? ret.qty : 0;
  const [booked] = await tx
    .select({ qty: sql<number>`coalesce(sum(${stockMovements.qty}), 0)::int` })
    .from(stockMovements)
    .where(and(eq(stockMovements.refType, "sales_return"), eq(stockMovements.refId, ret.id)));
  const delta = desired - (booked?.qty ?? 0);
  await writeStockMovements(tx, [
    {
      productId: ret.productId,
      movementDate: date,
      type: "return_in",
      qty: delta,
      refType: "sales_return",
      refId: ret.id,
      createdBy: actorId,
    },
  ]);
}
