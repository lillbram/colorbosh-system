import { and, eq, gte, lte, ne, notInArray, or, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  cashTransactions,
  categories,
  channels,
  products,
  salesEntries,
  salesReturns,
} from "@/db/schema";
import { computePnL, returnLoss, type CashOutRow, type ReturnRow, type SaleRow } from "@/lib/finance-calc";

async function loadSales(start: string, end: string): Promise<SaleRow[]> {
  const rows = await db
    .select({
      productId: salesEntries.productId,
      channelId: salesEntries.channelId,
      qty: salesEntries.qty,
      gross: salesEntries.grossAmount,
      discount: salesEntries.discount,
      fee: salesEntries.platformFeeEst,
      net: salesEntries.netExpected,
    })
    .from(salesEntries)
    .where(
      and(
        eq(salesEntries.isDeleted, false),
        eq(salesEntries.isReturned, false),
        gte(salesEntries.entryDate, start),
        lte(salesEntries.entryDate, end)
      )
    );
  return rows.map((r) => ({
    productId: r.productId,
    channelId: r.channelId,
    qty: r.qty,
    gross: Number(r.gross),
    discount: Number(r.discount ?? 0),
    fee: Number(r.fee ?? 0),
    net: Number(r.net),
  }));
}

async function loadCashOut(start: string, end: string): Promise<CashOutRow[]> {
  const rows = await db
    .select({ amount: cashTransactions.amount, categoryName: categories.name })
    .from(cashTransactions)
    .leftJoin(categories, eq(cashTransactions.categoryId, categories.id))
    .where(
      and(
        eq(cashTransactions.isDeleted, false),
        eq(cashTransactions.direction, "out"),
        // Old PO/tailor payments are production cost, not operating expense.
        or(
          isNull(cashTransactions.relatedType),
          notInArray(cashTransactions.relatedType, ["po_payment", "tailor_payment"])
        ),
        gte(cashTransactions.txnDate, start),
        lte(cashTransactions.txnDate, end)
      )
    );
  return rows.map((r) => ({ amount: Number(r.amount), categoryName: r.categoryName }));
}

/**
 * Returns are attributed to the month they were requested (Asia/Jakarta),
 * matching the owner's spreadsheet. Rejected returns don't count.
 */
async function loadReturns(start: string, end: string): Promise<ReturnRow[]> {
  const rows = await db
    .select({
      refundAmount: salesReturns.refundAmount,
      qty: salesReturns.qty,
      hppPerUnit: salesReturns.hppPerUnit,
      restock: salesReturns.restock,
    })
    .from(salesReturns)
    .where(
      and(
        eq(salesReturns.isDeleted, false),
        ne(salesReturns.status, "rejected"),
        sql`${salesReturns.requestedAt} >= (${start}::timestamp at time zone 'Asia/Jakarta')`,
        sql`${salesReturns.requestedAt} < ((${end}::date + 1)::timestamp at time zone 'Asia/Jakarta')`
      )
    );
  return rows.map((r) => ({
    refundAmount: Number(r.refundAmount),
    qty: r.qty,
    hppPerUnit: Number(r.hppPerUnit),
    restock: r.restock,
  }));
}

export async function getPnL(start: string, end: string) {
  const [sales, cashOut, returns, productList, channelList] = await Promise.all([
    loadSales(start, end),
    loadCashOut(start, end),
    loadReturns(start, end),
    db.select({ id: products.id, hppTarget: products.hppTarget }).from(products),
    db.select({ id: channels.id, name: channels.name }).from(channels),
  ]);

  const hppById = new Map(productList.map((p) => [p.id, Number(p.hppTarget ?? 0)]));
  const pnl = computePnL({ sales, hppById, cashOut, returnLoss: returnLoss(returns) });

  const channelNameById = new Map(channelList.map((c) => [c.id, c.name]));
  const byChannel = new Map<string, number>();
  for (const r of sales) {
    const name = (r.channelId ? channelNameById.get(r.channelId) : null) ?? "Tanpa Channel";
    byChannel.set(name, (byChannel.get(name) ?? 0) + r.gross);
  }
  const penjualanPerChannel = Array.from(byChannel.entries())
    .map(([name, gross]) => ({
      name,
      gross,
      pct: pnl.totalPenjualan > 0 ? (gross / pnl.totalPenjualan) * 100 : 0,
    }))
    .sort((a, b) => b.gross - a.gross);

  return { ...pnl, penjualanPerChannel };
}
