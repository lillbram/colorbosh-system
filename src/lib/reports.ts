import { and, eq, gte, lt, lte } from "drizzle-orm";
import { format, startOfMonth, subMonths } from "date-fns";
import { db } from "@/db";
import {
  accounts,
  cashTransactions,
  salesEntries,
  products,
  channels,
  tailorPayments,
  purchaseOrders,
  purchaseOrderPayments,
  productionBatches,
  productionBatchProducts,
  tailors,
  categories,
} from "@/db/schema";
import { getChannelBalances } from "@/lib/disbursement";
import { formatIDR } from "@/lib/format";

/**
 * Weighted-average cost per unit and total ever produced, per product,
 * computed from all finished batches. This is the cost basis used for both
 * per-product profit (getPerProductReport) and margin-based Profit Estimasi
 * — a product made across several batches at different costs gets one
 * blended cost rather than pretending each sale can be traced to a specific
 * batch (same "estimate honestly, don't fake precision" approach as the
 * disbursement FIFO aging). See CLAUDE.md §6.2 & §6.6.
 */
async function getProductCostBasis(): Promise<
  Map<string, { avgCost: number; totalProduced: number }>
> {
  const rows = await db
    .select({
      productId: productionBatchProducts.productId,
      actualQty: productionBatchProducts.actualQty,
      hppPerUnit: productionBatches.hppPerUnitCalc,
    })
    .from(productionBatchProducts)
    .innerJoin(productionBatches, eq(productionBatchProducts.batchId, productionBatches.id))
    .where(and(eq(productionBatches.status, "finished"), eq(productionBatches.isDeleted, false)));

  const totals = new Map<string, { totalQty: number; totalCost: number }>();
  for (const r of rows) {
    if (!r.productId || !r.actualQty || !r.hppPerUnit) continue;
    const existing = totals.get(r.productId) ?? { totalQty: 0, totalCost: 0 };
    existing.totalQty += r.actualQty;
    existing.totalCost += r.actualQty * Number(r.hppPerUnit);
    totals.set(r.productId, existing);
  }

  const result = new Map<string, { avgCost: number; totalProduced: number }>();
  for (const [productId, v] of totals) {
    result.set(productId, {
      avgCost: v.totalQty > 0 ? v.totalCost / v.totalQty : 0,
      totalProduced: v.totalQty,
    });
  }
  return result;
}

const CHANNEL_COLORS: Record<string, string> = {
  tiktok_live: "#3B4EA0",
  tiktok_shop: "#D97757",
  shopee: "#1F7A3A",
  other: "#6B7280",
};

export async function getSaldoKas(): Promise<number> {
  const [accountList, txns] = await Promise.all([
    db.select({ openingBalance: accounts.openingBalance }).from(accounts),
    db
      .select({ direction: cashTransactions.direction, amount: cashTransactions.amount })
      .from(cashTransactions)
      .where(eq(cashTransactions.isDeleted, false)),
  ]);

  const openingTotal = accountList.reduce((sum, a) => sum + Number(a.openingBalance), 0);
  const netMovement = txns.reduce(
    (sum, t) => sum + (t.direction === "in" ? 1 : -1) * Number(t.amount),
    0
  );
  return openingTotal + netMovement;
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

export async function getUangBelumCair(): Promise<number> {
  const balances = await getChannelBalances();
  return balances.reduce((sum, b) => sum + Math.max(0, b.outstanding), 0);
}

/**
 * Real margin-based profit: revenue recognized when sold minus that
 * product's actual cost (weighted-average HPP) minus operational expenses —
 * NOT a cash-flow proxy. Previously this just summed cash in/out for the
 * period, which conflates "profit" with "cash movement" (e.g. paying a big
 * kain/jahit bill this month for cardigans sold next month made this
 * month's "profit" look artificially negative). po_payment/tailor_payment
 * cash movements are intentionally excluded here since they're already
 * captured via each product's HPP — only `manual` cash_transactions (true
 * operating expenses: listrik, sewa, gaji, dst.) are subtracted on top of
 * COGS. See CLAUDE.md §6.6.
 */
export async function getProfitEstimasi(start: string, end: string): Promise<number> {
  const [salesRows, costBasis, opexRows] = await Promise.all([
    db
      .select({
        productId: salesEntries.productId,
        qty: salesEntries.qty,
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
    getProductCostBasis(),
    db
      .select({ amount: cashTransactions.amount })
      .from(cashTransactions)
      .where(
        and(
          eq(cashTransactions.isDeleted, false),
          eq(cashTransactions.relatedType, "manual"),
          eq(cashTransactions.direction, "out"),
          gte(cashTransactions.txnDate, start),
          lte(cashTransactions.txnDate, end)
        )
      ),
  ]);

  let revenue = 0;
  let cogs = 0;
  for (const r of salesRows) {
    revenue += Number(r.netExpected);
    const avgCost = r.productId ? (costBasis.get(r.productId)?.avgCost ?? 0) : 0;
    cogs += avgCost * r.qty;
  }
  const opex = opexRows.reduce((sum, r) => sum + Number(r.amount), 0);

  return revenue - cogs - opex;
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

export async function getAttentionItems(): Promise<AttentionItem[]> {
  const today = format(new Date(), "yyyy-MM-dd");

  const [overduePOs, overdueTermins, balances] = await Promise.all([
    db
      .select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.status, "ordered"), lt(purchaseOrders.expectedDate, today))),
    db
      .select({ batchId: tailorPayments.batchId, batchCode: productionBatches.batchCode })
      .from(tailorPayments)
      .innerJoin(productionBatches, eq(tailorPayments.batchId, productionBatches.id))
      .where(and(eq(tailorPayments.status, "due"), lt(tailorPayments.dueDate, today))),
    getChannelBalances(),
  ]);

  const items: AttentionItem[] = [];

  for (const po of overduePOs) {
    items.push({
      label: `PO ${po.poNumber} melewati estimasi tiba`,
      href: `/procurement/${po.id}`,
      severity: "danger",
    });
  }
  for (const t of overdueTermins) {
    items.push({
      label: `Termin penjahit ${t.batchCode} sudah jatuh tempo`,
      href: `/production/${t.batchId}`,
      severity: "danger",
    });
  }
  for (const b of balances) {
    if (b.outstanding <= 0.5) continue;
    items.push({
      label: `${b.channelName} — ${formatIDR(b.outstanding)} belum cair`,
      href: `/disbursement/${b.channelId}`,
      severity: b.oldestUnpaidDays !== null && b.oldestUnpaidDays > 14 ? "danger" : "warning",
    });
  }

  return items;
}

export async function getDashboardHighlights() {
  const today = format(new Date(), "yyyy-MM-dd");

  const [balances, overdueTermins, overduePOs] = await Promise.all([
    getChannelBalances(),
    db
      .select({ id: tailorPayments.id })
      .from(tailorPayments)
      .where(and(eq(tailorPayments.status, "due"), lt(tailorPayments.dueDate, today))),
    db
      .select({ id: purchaseOrders.id })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.status, "ordered"), lt(purchaseOrders.expectedDate, today))),
  ]);

  const topOutstanding = balances
    .filter((b) => b.outstanding > 0.5)
    .sort((a, b) => b.outstanding - a.outstanding)[0];

  return {
    topOutstanding: topOutstanding
      ? {
          channelName: topOutstanding.channelName,
          amount: topOutstanding.outstanding,
          oldestUnpaidDays: topOutstanding.oldestUnpaidDays,
        }
      : null,
    overdueTerminCount: overdueTermins.length,
    overduePoCount: overduePOs.length,
  };
}

export async function getPnLSummary(start: string, end: string) {
  const [salesRows, channelList, poPaymentRows, tailorPaymentRows, opexRows] = await Promise.all([
    db
      .select({
        channelId: salesEntries.channelId,
        grossAmount: salesEntries.grossAmount,
        discount: salesEntries.discount,
        platformFeeEst: salesEntries.platformFeeEst,
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
    db
      .select({ amount: purchaseOrderPayments.amount })
      .from(purchaseOrderPayments)
      .where(and(gte(purchaseOrderPayments.paymentDate, start), lte(purchaseOrderPayments.paymentDate, end))),
    db
      .select({ amount: tailorPayments.amount })
      .from(tailorPayments)
      .where(
        and(
          eq(tailorPayments.status, "paid"),
          gte(tailorPayments.paidDate, start),
          lte(tailorPayments.paidDate, end)
        )
      ),
    db
      .select({ amount: cashTransactions.amount, categoryId: cashTransactions.categoryId })
      .from(cashTransactions)
      .where(
        and(
          eq(cashTransactions.isDeleted, false),
          eq(cashTransactions.direction, "out"),
          eq(cashTransactions.relatedType, "manual"),
          gte(cashTransactions.txnDate, start),
          lte(cashTransactions.txnDate, end)
        )
      ),
  ]);

  const totalPenjualan = salesRows.reduce((sum, r) => sum + Number(r.grossAmount), 0);
  const totalDiskon = salesRows.reduce((sum, r) => sum + Number(r.discount ?? 0), 0);
  const totalFeePlatform = salesRows.reduce((sum, r) => sum + Number(r.platformFeeEst ?? 0), 0);
  const totalBersih = salesRows.reduce((sum, r) => sum + Number(r.netExpected), 0);
  const totalBayarSupplier = poPaymentRows.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalBayarPenjahit = tailorPaymentRows.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalOperasional = opexRows.reduce((sum, r) => sum + Number(r.amount), 0);
  const totalPengeluaran = totalBayarSupplier + totalBayarPenjahit + totalOperasional;
  const labaEstimasi = totalBersih - totalPengeluaran;

  const channelNameById = new Map(channelList.map((c) => [c.id, c.name]));
  const byChannel = new Map<string, number>();
  for (const r of salesRows) {
    const name = (r.channelId ? channelNameById.get(r.channelId) : null) ?? "Tanpa Channel";
    byChannel.set(name, (byChannel.get(name) ?? 0) + Number(r.grossAmount));
  }
  const penjualanPerChannel = Array.from(byChannel.entries())
    .map(([name, gross]) => ({
      name,
      gross,
      pct: totalPenjualan > 0 ? (gross / totalPenjualan) * 100 : 0,
    }))
    .sort((a, b) => b.gross - a.gross);

  return {
    totalPenjualan,
    penjualanPerChannel,
    totalDiskon,
    totalFeePlatform,
    totalBersih,
    totalBayarSupplier,
    totalBayarPenjahit,
    totalOperasional,
    totalPengeluaran,
    labaEstimasi,
  };
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
  const [periodRows, allTimeSoldRows, costBasis] = await Promise.all([
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
    db
      .select({ productId: salesEntries.productId, qty: salesEntries.qty })
      .from(salesEntries)
      .where(and(eq(salesEntries.isDeleted, false), eq(salesEntries.isReturned, false))),
    getProductCostBasis(),
  ]);

  const totalSoldAllTime = new Map<string, number>();
  for (const r of allTimeSoldRows) {
    if (!r.productId) continue;
    totalSoldAllTime.set(r.productId, (totalSoldAllTime.get(r.productId) ?? 0) + r.qty);
  }

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
      const basis = costBasis.get(p.productId);
      const avgCost = basis?.avgCost ?? 0;
      const totalProduced = basis?.totalProduced ?? 0;
      const soldAllTime = totalSoldAllTime.get(p.productId) ?? 0;
      return {
        name: p.name,
        qty: p.qty,
        gross: p.gross,
        bersih: p.bersih,
        avgCost,
        stock: totalProduced - soldAllTime,
        profit: p.bersih - avgCost * p.qty,
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

export async function getPerTailorReport(start: string, end: string) {
  const [tailorList, payments, batches] = await Promise.all([
    db.select({ id: tailors.id, name: tailors.name }).from(tailors),
    db.select().from(tailorPayments),
    db
      .select({ id: productionBatches.id, tailorId: productionBatches.tailorId, startDate: productionBatches.startDate })
      .from(productionBatches)
      .where(
        and(
          eq(productionBatches.isDeleted, false),
          gte(productionBatches.startDate, start),
          lte(productionBatches.startDate, end)
        )
      ),
  ]);

  const batchToTailor = new Map(batches.map((b) => [b.id, b.tailorId]));
  const result = new Map(
    tailorList.map((t) => [t.id, { name: t.name, batchCount: 0, totalDibayar: 0, totalTertunda: 0 }])
  );

  for (const b of batches) {
    if (b.tailorId) {
      const entry = result.get(b.tailorId);
      if (entry) entry.batchCount += 1;
    }
  }

  for (const p of payments) {
    const tailorId = batchToTailor.get(p.batchId);
    if (!tailorId) continue;
    const entry = result.get(tailorId);
    if (!entry) continue;

    if (p.status === "paid" && p.paidDate && p.paidDate >= start && p.paidDate <= end) {
      entry.totalDibayar += Number(p.amount);
    } else if (p.status !== "paid") {
      entry.totalTertunda += Number(p.amount);
    }
  }

  return Array.from(result.values()).filter((t) => t.batchCount > 0 || t.totalTertunda > 0);
}

export async function getAgingPayoutReport() {
  const balances = await getChannelBalances();

  return balances
    .filter((b) => b.outstanding > 0.5)
    .map((b) => {
      const daysOverdue = b.oldestUnpaidDays ?? 0;
      return {
        channelName: b.channelName,
        periode: b.oldestUnpaidDate ? `Sejak ${b.oldestUnpaidDate}` : "-",
        expectedAmount: b.outstanding,
        expectedPayoutDate: b.oldestUnpaidDate,
        daysOverdue,
        bucket:
          daysOverdue <= 0
            ? "Belum Jatuh Tempo"
            : daysOverdue <= 7
              ? "1-7 Hari"
              : daysOverdue <= 14
                ? "8-14 Hari"
                : daysOverdue <= 30
                  ? "15-30 Hari"
                  : "> 30 Hari",
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
}
