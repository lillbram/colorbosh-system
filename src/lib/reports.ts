import { and, eq, gte, lte, sql } from "drizzle-orm";
import { todayJakarta } from "@/lib/period";
import { format, startOfMonth, subMonths } from "date-fns";
import { db } from "@/db";
import { getPnL } from "@/lib/finance";
import { accounts, cashTransactions, salesEntries, products, channels, categories } from "@/db/schema";

const CHANNEL_COLORS: Record<string, string> = {
  tiktok_live: "#3B4EA0",
  tiktok_shop: "#D97757",
  shopee: "#1F7A3A",
  other: "#6B7280",
};

export async function getSaldoKas(): Promise<{ saldo: number; lastTxnDate: string | null }> {
  const [accountList, txns] = await Promise.all([
    db.select({ openingBalance: accounts.openingBalance }).from(accounts),
    db
      .select({
        direction: cashTransactions.direction,
        amount: cashTransactions.amount,
        txnDate: cashTransactions.txnDate,
      })
      .from(cashTransactions)
      .where(eq(cashTransactions.isDeleted, false)),
  ]);

  const openingTotal = accountList.reduce((sum, a) => sum + Number(a.openingBalance), 0);
  const netMovement = txns.reduce(
    (sum, t) => sum + (t.direction === "in" ? 1 : -1) * Number(t.amount),
    0
  );
  const lastTxnDate = txns.reduce<string | null>(
    (latest, t) => (!latest || t.txnDate > latest ? t.txnDate : latest),
    null
  );
  return { saldo: openingTotal + netMovement, lastTxnDate };
}

export async function getPenjualanPeriode(start: string, end: string): Promise<number> {
  const rows = await db
    .select({ grossAmount: salesEntries.grossAmount })
    .from(salesEntries)
    .where(
      and(
        eq(salesEntries.isDeleted, false),
        eq(salesEntries.isReturned, false),
        gte(salesEntries.entryDate, start),
        lte(salesEntries.entryDate, end)
      )
    );
  return rows.reduce((sum, r) => sum + Number(r.grossAmount), 0);
}

/**
 * Laba Bersih for the period — delegates to finance.ts so Dashboard,
 * Laporan and Penjualan all show the same number. See CLAUDE.md §6.6.
 */
export async function getProfitEstimasi(start: string, end: string): Promise<number> {
  return (await getPnL(start, end)).labaBersih;
}

export async function getTopProduk(start: string, end: string, limit = 5) {
  const rows = await db
    .select({
      productName: products.name,
      qty: salesEntries.qty,
      grossAmount: salesEntries.grossAmount,
    })
    .from(salesEntries)
    .leftJoin(products, eq(salesEntries.productId, products.id))
    .where(
      and(
        eq(salesEntries.isDeleted, false),
        eq(salesEntries.isReturned, false),
        gte(salesEntries.entryDate, start),
        lte(salesEntries.entryDate, end)
      )
    );

  const byProduct = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const r of rows) {
    const name = r.productName ?? "Tanpa Produk";
    const existing = byProduct.get(name);
    if (existing) {
      existing.qty += r.qty;
      existing.revenue += Number(r.grossAmount);
    } else {
      byProduct.set(name, { name, qty: r.qty, revenue: Number(r.grossAmount) });
    }
  }

  return Array.from(byProduct.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export async function getRevenueTrendByChannel(start: string, end: string) {
  const [rows, channelList] = await Promise.all([
    db
      .select({
        entryDate: salesEntries.entryDate,
        channelId: salesEntries.channelId,
        grossAmount: salesEntries.grossAmount,
      })
      .from(salesEntries)
      .where(
        and(
          eq(salesEntries.isDeleted, false),
          eq(salesEntries.isReturned, false),
          gte(salesEntries.entryDate, start),
          lte(salesEntries.entryDate, end)
        )
      ),
    db.select({ id: channels.id, name: channels.name }).from(channels),
  ]);

  const channelNameById = new Map(channelList.map((c) => [c.id, c.name]));
  const byDate = new Map<string, Record<string, number>>();

  for (const r of rows) {
    const channelName = channelNameById.get(r.channelId ?? "") ?? "Lainnya";
    const dayEntry = byDate.get(r.entryDate) ?? {};
    dayEntry[channelName] = (dayEntry[channelName] ?? 0) + Number(r.grossAmount);
    byDate.set(r.entryDate, dayEntry);
  }

  const sortedDates = Array.from(byDate.keys()).sort();
  return {
    channelNames: channelList.map((c) => c.name),
    data: sortedDates.map((date) => ({ date, ...byDate.get(date) })),
  };
}

export async function getMonthlyRevenueTrend(months = 7) {
  const start = format(startOfMonth(subMonths(new Date(), months - 1)), "yyyy-MM-dd");

  const rows = await db
    .select({ entryDate: salesEntries.entryDate, grossAmount: salesEntries.grossAmount })
    .from(salesEntries)
    .where(
      and(
        eq(salesEntries.isDeleted, false),
        eq(salesEntries.isReturned, false),
        gte(salesEntries.entryDate, start)
      )
    );

  const buckets = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const key = format(startOfMonth(subMonths(new Date(), i)), "yyyy-MM");
    buckets.set(key, 0);
  }

  for (const r of rows) {
    const key = r.entryDate.slice(0, 7);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + Number(r.grossAmount));
    }
  }

  return Array.from(buckets.entries()).map(([key, amount]) => ({
    month: format(new Date(`${key}-01`), "MMM"),
    amount,
  }));
}

export async function getChannelBreakdown(start: string, end: string) {
  const [rows, channelList] = await Promise.all([
    db
      .select({ channelId: salesEntries.channelId, grossAmount: salesEntries.grossAmount })
      .from(salesEntries)
      .where(
        and(
          eq(salesEntries.isDeleted, false),
          eq(salesEntries.isReturned, false),
          gte(salesEntries.entryDate, start),
          lte(salesEntries.entryDate, end)
        )
      ),
    db.select().from(channels),
  ]);

  const channelById = new Map(channelList.map((c) => [c.id, c]));
  const byChannel = new Map<string, { name: string; value: number; color: string }>();

  for (const r of rows) {
    if (!r.channelId) continue;
    const channel = channelById.get(r.channelId);
    if (!channel) continue;
    const existing = byChannel.get(channel.id);
    if (existing) {
      existing.value += Number(r.grossAmount);
    } else {
      byChannel.set(channel.id, {
        name: channel.name,
        value: Number(r.grossAmount),
        color: CHANNEL_COLORS[channel.type] ?? CHANNEL_COLORS.other,
      });
    }
  }

  return Array.from(byChannel.values()).sort((a, b) => b.value - a.value);
}

export type AttentionItem = { label: string; href: string; severity: "warning" | "danger" };

/**
 * No standing "needs attention" triggers left in this simplified POS flow
 * (no PO/production/disbursement to go overdue) — kept as a function
 * returning [] so NotificationBell doesn't need special-casing, and so a
 * future alert (e.g. negative cash balance) has an obvious place to land.
 */
export async function getAttentionItems(): Promise<AttentionItem[]> {
  return [];
}

export async function getTodayPcs(): Promise<number> {
  const [row] = await db
    .select({ pcs: sql<number>`coalesce(sum(${salesEntries.qty}), 0)::int` })
    .from(salesEntries)
    .where(
      and(
        eq(salesEntries.isDeleted, false),
        eq(salesEntries.isReturned, false),
        eq(salesEntries.entryDate, todayJakarta())
      )
    );
  return row?.pcs ?? 0;
}

export async function getTodaySummary() {
  const today = todayJakarta();
  const rows = await db
    .select({ grossAmount: salesEntries.grossAmount, channelId: salesEntries.channelId })
    .from(salesEntries)
    .where(
      and(
        eq(salesEntries.isDeleted, false),
        eq(salesEntries.isReturned, false),
        eq(salesEntries.entryDate, today)
      )
    );

  const total = rows.reduce((sum, r) => sum + Number(r.grossAmount), 0);
  const channelCount = new Set(rows.map((r) => r.channelId).filter(Boolean)).size;

  return { transactionCount: rows.length, total, channelCount };
}

export async function getPnLSummary(start: string, end: string) {
  return getPnL(start, end);
}

export async function getPerChannelReport(start: string, end: string) {
  const [rows, channelList] = await Promise.all([
    db
      .select({
        channelId: salesEntries.channelId,
        grossAmount: salesEntries.grossAmount,
        netExpected: salesEntries.netExpected,
      })
      .from(salesEntries)
      .where(
        and(
          eq(salesEntries.isDeleted, false),
          eq(salesEntries.isReturned, false),
          gte(salesEntries.entryDate, start),
          lte(salesEntries.entryDate, end)
        )
      ),
    db.select({ id: channels.id, name: channels.name }).from(channels),
  ]);

  const byChannel = new Map(
    channelList.map((c) => [c.id, { name: c.name, transaksi: 0, gross: 0, bersih: 0 }])
  );

  for (const r of rows) {
    const entry = r.channelId ? byChannel.get(r.channelId) : undefined;
    if (!entry) continue;
    entry.transaksi += 1;
    entry.gross += Number(r.grossAmount);
    entry.bersih += Number(r.netExpected);
  }

  return Array.from(byChannel.values()).filter((c) => c.transaksi > 0);
}

export async function getPerProductReport(start: string, end: string) {
  const [periodRows, productList] = await Promise.all([
    db
      .select({
        productId: salesEntries.productId,
        productName: products.name,
        qty: salesEntries.qty,
        grossAmount: salesEntries.grossAmount,
        netExpected: salesEntries.netExpected,
      })
      .from(salesEntries)
      .leftJoin(products, eq(salesEntries.productId, products.id))
      .where(
        and(
          eq(salesEntries.isDeleted, false),
          eq(salesEntries.isReturned, false),
          gte(salesEntries.entryDate, start),
          lte(salesEntries.entryDate, end)
        )
      ),
    db.select({ id: products.id, hppTarget: products.hppTarget }).from(products),
  ]);

  const hppById = new Map(productList.map((p) => [p.id, Number(p.hppTarget ?? 0)]));

  const byProduct = new Map<
    string,
    { productId: string; name: string; qty: number; gross: number; bersih: number }
  >();
  for (const r of periodRows) {
    const key = r.productId ?? "unknown";
    const name = r.productName ?? "Tanpa Produk";
    const existing = byProduct.get(key);
    if (existing) {
      existing.qty += r.qty;
      existing.gross += Number(r.grossAmount);
      existing.bersih += Number(r.netExpected);
    } else {
      byProduct.set(key, { productId: key, name, qty: r.qty, gross: Number(r.grossAmount), bersih: Number(r.netExpected) });
    }
  }

  return Array.from(byProduct.values())
    .map((p) => {
      const hpp = hppById.get(p.productId) ?? 0;
      return {
        name: p.name,
        qty: p.qty,
        gross: p.gross,
        bersih: p.bersih,
        hpp,
        profit: p.bersih - hpp * p.qty,
      };
    })
    .sort((a, b) => b.gross - a.gross);
}

export async function getCashFlowReport(start: string, end: string) {
  const rows = await db
    .select({
      txnDate: cashTransactions.txnDate,
      direction: cashTransactions.direction,
      amount: cashTransactions.amount,
      description: cashTransactions.description,
      accountId: cashTransactions.accountId,
      categoryId: cashTransactions.categoryId,
    })
    .from(cashTransactions)
    .where(
      and(
        eq(cashTransactions.isDeleted, false),
        gte(cashTransactions.txnDate, start),
        lte(cashTransactions.txnDate, end)
      )
    );

  const [accountList, categoryList] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name }).from(accounts),
    db.select({ id: categories.id, name: categories.name }).from(categories),
  ]);
  const accountNameById = new Map(accountList.map((a) => [a.id, a.name]));
  const categoryNameById = new Map(categoryList.map((c) => [c.id, c.name]));

  return rows
    .map((r) => ({
      tanggal: r.txnDate,
      arah: r.direction,
      nominal: Number(r.amount),
      keterangan: r.description ?? "-",
      akun: r.accountId ? (accountNameById.get(r.accountId) ?? "-") : "-",
      kategori: r.categoryId ? (categoryNameById.get(r.categoryId) ?? "-") : "-",
    }))
    .sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
}
