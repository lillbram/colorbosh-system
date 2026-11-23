import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, salesEntries, salesReturns } from "@/db/schema";
import { getPnL, getSalaryOverview, getWorkingCapital } from "@/lib/finance";
import { getSaldoKas, getTodaySummary } from "@/lib/reports";
import { monthToDate, previousPeriod, todayJakarta } from "@/lib/period";
import { getLowStockThreshold, getStockLevels } from "@/lib/stock";

/**
 * Numbers for the daily recap. Everything is computed here (finance.ts is the
 * single source of truth); the model only words them and flags oddities.
 */
export async function getRecapFacts() {
  const today = todayJakarta();
  const cur = monthToDate();
  const prev = previousPeriod(cur.start, cur.end);

  const [pnl, prevPnl, todaySummary, saldo, capital, salary, stock, threshold, returnRows] = await Promise.all([
    getPnL(cur.start, cur.end),
    getPnL(prev.start, prev.end),
    getTodaySummary(),
    getSaldoKas(),
    getWorkingCapital(today),
    getSalaryOverview(),
    getStockLevels(),
    getLowStockThreshold(),
    db
      .select({ qty: salesReturns.qty, refund: salesReturns.refundAmount })
      .from(salesReturns)
      .where(
        and(
          eq(salesReturns.isDeleted, false),
          sql`${salesReturns.status} <> 'rejected'`,
          sql`${salesReturns.requestedAt} >= (${cur.start}::timestamp at time zone 'Asia/Jakarta')`
        )
      ),
  ]);
  const prevReturns = await db
    .select({ qty: salesReturns.qty })
    .from(salesReturns)
    .where(
      and(
        eq(salesReturns.isDeleted, false),
        sql`${salesReturns.status} <> 'rejected'`,
        sql`${salesReturns.requestedAt} >= (${prev.start}::timestamp at time zone 'Asia/Jakarta')`,
        sql`${salesReturns.requestedAt} < ((${prev.end}::date + 1)::timestamp at time zone 'Asia/Jakarta')`
      )
    );

  // Sold products with no HPP, and products whose sales lose money (per unit, this period).
  const sold = await db
    .select({
      name: products.name,
      hpp: products.hppTarget,
      qty: sql<number>`sum(${salesEntries.qty})::int`,
      net: sql<number>`sum(${salesEntries.netExpected})::float`,
    })
    .from(salesEntries)
    .innerJoin(products, eq(salesEntries.productId, products.id))
    .where(
      and(
        eq(salesEntries.isDeleted, false),
        eq(salesEntries.isReturned, false),
        gte(salesEntries.entryDate, cur.start),
        lte(salesEntries.entryDate, cur.end)
      )
    )
    .groupBy(products.id);
  const noHpp = sold.filter((p) => !Number(p.hpp ?? 0)).map((p) => p.name);
  const negativeMargin = sold
    .filter((p) => Number(p.hpp ?? 0) > 0 && p.net / p.qty < Number(p.hpp))
    .map((p) => ({ product: p.name, avgNetPerPcs: Math.round(p.net / p.qty), hpp: Number(p.hpp) }));

  const daysSinceCash = saldo.lastTxnDate
    ? Math.floor((Date.parse(today) - Date.parse(saldo.lastTxnDate)) / 86_400_000)
    : null;
  const unpaidSalary = salary.months.filter((m) => m.remaining > 0).map((m) => ({ month: m.month, remaining: Math.round(m.remaining) }));

  return {
    asOf: today,
    period: { current: cur, previous: prev },
    thisPeriod: pnl,
    previousPeriod: prevPnl,
    today: todaySummary,
    cash: { balance: saldo.saldo, lastRecorded: saldo.lastTxnDate, daysSinceLastRecord: daysSinceCash },
    workingCapital: capital,
    unpaidSalary,
    returns: {
      thisPeriodPcs: returnRows.reduce((s, r) => s + r.qty, 0),
      thisPeriodRefund: returnRows.reduce((s, r) => s + Number(r.refund), 0),
      previousPeriodPcs: prevReturns.reduce((s, r) => s + r.qty, 0),
    },
    lowStock: stock
      .filter((l) => l.hasOpening && l.qty <= threshold)
      .map((l) => ({ product: l.name, qty: l.qty })),
    productsSoldWithoutHpp: noHpp,
    productsWithNegativeMargin: negativeMargin,
  };
}
