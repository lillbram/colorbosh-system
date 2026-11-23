import { Wallet, ShoppingBag, TrendingUp, Star, Receipt } from "lucide-react";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/stats/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { ChannelDonut } from "@/components/dashboard/channel-donut";
import { MonthPicker } from "@/components/shared/month-picker";
import { RecapCard } from "@/components/dashboard/recap-card";
import { claudeEnabled } from "@/lib/claude";
import { formatIDR, lastRecordedNote } from "@/lib/format";
import { getCurrentRole } from "@/lib/auth";
import { getLowStockThreshold, getStockLevels } from "@/lib/stock";
import { monthLabel, monthToDate, previousPeriod, recentMonths, todayJakarta } from "@/lib/period";
import {
  getSaldoKas,
  getPenjualanPeriode,
  getProfitEstimasi,
  getTopProduk,
  getMonthlyRevenueTrend,
  getChannelBreakdown,
  getTodaySummary,
  getTodayPcs,
} from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const { start: monthStart, end: monthEnd, month } = monthToDate(monthParam);
  const prev = previousPeriod(monthStart, monthEnd);
  const isOwner = (await getCurrentRole()) === "owner";
  const label = monthLabel(month);

  const [
    saldoKas,
    penjualanBulanIni,
    penjualanBulanLalu,
    profitBulanIni,
    profitBulanLalu,
    topProduk,
    monthlyTrend,
    channelBreakdown,
    todaySummary,
  ] = await Promise.all([
    getSaldoKas(),
    getPenjualanPeriode(monthStart, monthEnd),
    getPenjualanPeriode(prev.start, prev.end),
    isOwner ? getProfitEstimasi(monthStart, monthEnd) : Promise.resolve(0),
    isOwner ? getProfitEstimasi(prev.start, prev.end) : Promise.resolve(0),
    getTopProduk(monthStart, monthEnd, 3),
    getMonthlyRevenueTrend(7),
    getChannelBreakdown(monthStart, monthEnd),
    getTodaySummary(),
  ]);

  // Admin lands on today's numbers first: pcs sold, omzet, products running low.
  const [todayPcs, stockLevels, lowThreshold] = isOwner
    ? [0, [], 0]
    : await Promise.all([getTodayPcs(), getStockLevels(), getLowStockThreshold()]);
  const lowStockCount = stockLevels.filter((l) => l.hasOpening && l.qty <= lowThreshold).length;

  const salesTrendPct =
    penjualanBulanLalu > 0
      ? Math.round(((penjualanBulanIni - penjualanBulanLalu) / penjualanBulanLalu) * 100)
      : 0;
  const profitTrendPct =
    profitBulanLalu !== 0
      ? Math.round(((profitBulanIni - profitBulanLalu) / Math.abs(profitBulanLalu)) * 100)
      : 0;

  return (
    <>
      <Header title="Ringkasan Bisnis" subtitle="Pantau kas, penjualan, dan profit." />

      <main className="flex-1 space-y-6 p-4 md:p-6">
        {!isOwner && (
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3">
              <p className="text-xs text-muted">Terjual hari ini</p>
              <p className="font-mono-num mt-1 text-xl font-bold text-ink">{todayPcs} pcs</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted">Omzet hari ini</p>
              <p className="font-mono-num mt-1 text-base font-bold text-ink md:text-xl">
                {formatIDR(todaySummary.total)}
              </p>
            </Card>
            <Card className={`p-3 ${lowStockCount > 0 ? "border-warning/50 bg-warning/5" : ""}`}>
              <p className="text-xs text-muted">Stok menipis</p>
              <p className="font-mono-num mt-1 text-xl font-bold text-ink">{lowStockCount} produk</p>
            </Card>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <MonthPicker basePath="/" params={{}} months={recentMonths()} value={monthParam ? month : null} />
          <p className="text-sm text-muted">
            {label}: {monthStart.slice(8)}–{monthEnd.slice(8)} · dibanding periode sama bulan sebelumnya
          </p>
        </div>

        {isOwner && <RecapCard enabled={claudeEnabled()} today={todayJakarta()} />}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={Wallet}
            label="Saldo Kas"
            value={saldoKas.saldo}
            isMoney
            note={lastRecordedNote(saldoKas.lastTxnDate, todayJakarta())}
          />
          <StatCard
            icon={ShoppingBag}
            label={`Penjualan ${label}`}
            value={penjualanBulanIni}
            isMoney
            trend={{
              direction: salesTrendPct > 0 ? "up" : salesTrendPct < 0 ? "down" : "none",
              percent: Math.abs(salesTrendPct),
            }}
            footer="vs periode sama bulan lalu"
          />
          {isOwner && (
          <StatCard
              icon={TrendingUp}
              label="Laba Bersih"
              value={profitBulanIni}
              isMoney
              trend={{
                direction: profitTrendPct > 0 ? "up" : profitTrendPct < 0 ? "down" : "none",
                percent: Math.abs(profitTrendPct),
              }}
              footer="vs periode sama bulan lalu"
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Uang Masuk 7 Bulan Terakhir</CardTitle>
            </CardHeader>
            <CardContent>
              <RevenueChart data={monthlyTrend} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <Receipt className="size-4 text-primary-500" />
                Hari Ini
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg bg-canvas p-3">
                <p className="text-sm text-muted">Total Transaksi</p>
                <p className="font-mono-num mt-1 text-xl font-bold text-ink">
                  {todaySummary.transactionCount}
                </p>
              </div>
              <div className="rounded-lg bg-canvas p-3">
                <p className="text-sm text-muted">Total Penjualan</p>
                <p className="font-mono-num mt-1 text-xl font-bold text-ink">
                  {formatIDR(todaySummary.total)}
                </p>
              </div>
              <div className="rounded-lg bg-canvas p-3">
                <p className="text-sm text-muted">Channel Aktif</p>
                <p className="font-mono-num mt-1 text-xl font-bold text-ink">
                  {todaySummary.channelCount}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Penjualan per Channel ({label})</CardTitle>
            </CardHeader>
            <CardContent>
              <ChannelDonut data={channelBreakdown} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <Star className="size-4 text-accent-500" />
                Produk Terlaris
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topProduk.length === 0 ? (
                <p className="text-sm text-muted">Belum ada penjualan pada bulan ini.</p>
              ) : (
                topProduk.map((p) => (
                  <div key={p.name} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink">{p.name}</p>
                      <p className="text-xs text-muted">{p.qty} terjual</p>
                    </div>
                    <p className="font-mono-num text-sm font-semibold text-ink">
                      {formatIDR(p.revenue)}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
