import { and, eq, gte, lte, ne, notInArray, or, isNull, sql } from "drizzle-orm";
import { addDays, addMonths, format, parseISO } from "date-fns";
import { db } from "@/db";
import {
  accounts,
  cashTransactions,
  categories,
  channels,
  marketplaceBalanceSnapshots,
  products,
  salesEntries,
  salesReturns,
  settings,
  stockMovements,
} from "@/db/schema";
import {
  allocateSalary,
  computePnL,
  returnLoss,
  type CashOutRow,
  type ReturnRow,
  type SalaryMonth,
  type SaleRow,
} from "@/lib/finance-calc";
import { monthRange, todayJakarta } from "@/lib/period";

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

export type SalaryOverview = {
  pct: number;
  months: (SalaryMonth & { labaBersih: number })[];
  payments: {
    id: string;
    txnDate: string;
    amount: number;
    periodMonth: string | null;
    description: string | null;
    hasProof: boolean;
  }[];
};

/**
 * Per month from the first sale until now: Laba Bersih, entitlement
 * (max(0, laba) × salaryPct), Gaji paid and what is left. Payments naming a
 * month go to it; the rest fill the oldest remainder (allocateSalary).
 */
export async function getSalaryOverview(): Promise<SalaryOverview> {
  const [first] = await db
    .select({ d: sql<string | null>`min(${salesEntries.entryDate})` })
    .from(salesEntries)
    .where(eq(salesEntries.isDeleted, false));
  const [cfg] = await db.select({ pct: settings.salaryPct }).from(settings).where(eq(settings.id, 1));
  const pct = Number(cfg?.pct ?? 1);

  const payments = await db
    .select({
      id: cashTransactions.id,
      txnDate: cashTransactions.txnDate,
      amount: cashTransactions.amount,
      periodMonth: cashTransactions.periodMonth,
      description: cashTransactions.description,
      proofUrl: cashTransactions.proofUrl,
    })
    .from(cashTransactions)
    .innerJoin(categories, eq(cashTransactions.categoryId, categories.id))
    .where(
      and(
        eq(categories.name, "Gaji"),
        eq(cashTransactions.direction, "out"),
        eq(cashTransactions.isDeleted, false)
      )
    )
    .orderBy(cashTransactions.txnDate);
  const paymentRows = payments.map((p) => ({
    id: p.id,
    txnDate: p.txnDate,
    amount: Number(p.amount),
    periodMonth: p.periodMonth,
    description: p.description,
    hasProof: !!p.proofUrl,
  }));

  if (!first?.d) return { pct, months: [], payments: paymentRows };

  const lastMonth = todayJakarta().slice(0, 7);
  const monthList: string[] = [];
  for (let m = parseISO(`${first.d.slice(0, 7)}-01`); format(m, "yyyy-MM") <= lastMonth; m = addMonths(m, 1)) {
    monthList.push(format(m, "yyyy-MM"));
  }
  const pnls = await Promise.all(
    monthList.map((month) => {
      const r = monthRange(month);
      return getPnL(r.start, r.end);
    })
  );
  const allocated = allocateSalary(
    monthList.map((month, i) => ({ month, entitlement: Math.max(0, pnls[i].labaBersih) * pct })),
    paymentRows.map((p) => ({ periodMonth: p.periodMonth, amount: p.amount }))
  );
  return {
    pct,
    months: allocated.map((m, i) => ({ ...m, labaBersih: pnls[i].labaBersih })),
    payments: paymentRows,
  };
}

/**
 * Oldest month where salary entitlement is not yet covered by Gaji payments,
 * or null when everything is paid / no sales yet. Suggests the period for a
 * Gaji transfer (Phase 6).
 */
export async function getOldestUnpaidSalaryMonth(): Promise<string | null> {
  const { months } = await getSalaryOverview();
  return months.find((m) => m.remaining > 0)?.month ?? null;
}

export type WorkingCapital = {
  date: string;
  bank: number;
  marketplace: number;
  stockValue: number;
  salaryRemaining: number;
  total: number;
};

type CapitalData = {
  openingTotal: number;
  txns: { date: string; signed: number }[];
  snapshots: { channelId: string | null; date: string; value: number }[];
  movements: { productId: string; date: string; qty: number }[];
  hpp: Map<string, number>;
};

async function loadCapitalData(): Promise<CapitalData> {
  const [accountList, txns, snaps, moves, productList] = await Promise.all([
    db.select({ openingBalance: accounts.openingBalance }).from(accounts),
    db
      .select({ date: cashTransactions.txnDate, direction: cashTransactions.direction, amount: cashTransactions.amount })
      .from(cashTransactions)
      .where(eq(cashTransactions.isDeleted, false)),
    db
      .select({
        channelId: marketplaceBalanceSnapshots.channelId,
        date: marketplaceBalanceSnapshots.snapshotDate,
        awaiting: marketplaceBalanceSnapshots.awaitingDelivery,
        processing: marketplaceBalanceSnapshots.settlementProcessing,
      })
      .from(marketplaceBalanceSnapshots),
    db
      .select({ productId: stockMovements.productId, date: stockMovements.movementDate, qty: stockMovements.qty })
      .from(stockMovements),
    db.select({ id: products.id, hpp: products.hppTarget }).from(products),
  ]);
  return {
    openingTotal: accountList.reduce((s, a) => s + Number(a.openingBalance), 0),
    txns: txns.map((t) => ({ date: t.date, signed: (t.direction === "in" ? 1 : -1) * Number(t.amount) })),
    snapshots: snaps.map((r) => ({ channelId: r.channelId, date: r.date, value: Number(r.awaiting) + Number(r.processing) })),
    movements: moves,
    hpp: new Map(productList.map((p) => [p.id, Number(p.hpp ?? 0)])),
  };
}

function capitalAt(d: CapitalData, date: string) {
  const bank = d.openingTotal + d.txns.filter((t) => t.date <= date).reduce((s, t) => s + t.signed, 0);

  // Latest snapshot per channel on or before `date`.
  const latest = new Map<string, { date: string; value: number }>();
  for (const sn of d.snapshots) {
    if (sn.date > date) continue;
    const key = sn.channelId ?? "none";
    const cur = latest.get(key);
    if (!cur || sn.date >= cur.date) latest.set(key, { date: sn.date, value: sn.value });
  }
  const marketplace = [...latest.values()].reduce((s, v) => s + v.value, 0);

  const qtyByProduct = new Map<string, number>();
  for (const m of d.movements) {
    if (m.date <= date) qtyByProduct.set(m.productId, (qtyByProduct.get(m.productId) ?? 0) + m.qty);
  }
  const stockValue = [...qtyByProduct.entries()].reduce((s, [id, q]) => s + Math.max(0, q) * (d.hpp.get(id) ?? 0), 0);
  return { bank, marketplace, stockValue };
}

/** Modal Berjalan = bank + marketplace (awaiting + settlement processing) + stock value − salary still owed. */
export async function getWorkingCapital(date = todayJakarta()): Promise<WorkingCapital> {
  const [data, salary] = await Promise.all([loadCapitalData(), getSalaryOverview()]);
  const c = capitalAt(data, date);
  const salaryRemaining = salary.months.reduce((s, m) => s + Math.max(0, m.remaining), 0);
  return { date, ...c, salaryRemaining, total: c.bank + c.marketplace + c.stockValue - salaryRemaining };
}

/**
 * Weekly points for the trend chart: bank + marketplace + stock value as of
 * each week end. Salary owed is not subtracted historically (it would need the
 * P&L as of every date), so the line is "modal sebelum potong gaji".
 */
export async function getCapitalTrend(weeks = 12): Promise<{ date: string; value: number }[]> {
  const data = await loadCapitalData();
  const today = parseISO(todayJakarta());
  return Array.from({ length: weeks }, (_, i) => {
    const date = format(addDays(today, -7 * (weeks - 1 - i)), "yyyy-MM-dd");
    const c = capitalAt(data, date);
    return { date, value: c.bank + c.marketplace + c.stockValue };
  });
}
