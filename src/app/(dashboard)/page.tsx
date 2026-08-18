import { Wallet, ShoppingBag, TrendingUp, Star, Receipt } from "lucide-react";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/stats/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { ChannelDonut } from "@/components/dashboard/channel-donut";
import { formatIDR } from "@/lib/format";
import {
  getSaldoKas,
  getPenjualanPeriode,
  getProfitEstimasi,
  getTopProduk,
  getMonthlyRevenueTrend,
  getChannelBreakdown,
  getTodaySummary,
} from "@/lib/reports";

export const dynamic = "force-dynamic";

export default async function DashboardHomePage() {
  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const prevMonthStart = format(startOfMonth(subMonths(now, 1)), "yyyy-MM-dd");
  const prevMonthEnd = format(endOfMonth(subMonths(now, 1)), "yyyy-MM-dd");

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
    getPenjualanPeriode(prevMonthStart, prevMonthEnd),
    getProfitEstimasi(monthStart, monthEnd),
    getProfitEstimasi(prevMonthStart, prevMonthEnd),
    getTopProduk(monthStart, monthEnd, 3),
    getMonthlyRevenueTrend(7),
    getChannelBreakdown(monthStart, monthEnd),
    getTodaySummary(),
  ]);

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

      <main className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard icon={Wallet} label="Saldo Kas" value={saldoKas} isMoney />
          <StatCard
            icon={ShoppingBag}
            label="Penjualan Bulan Ini"
            value={penjualanBulanIni}
            isMoney
            trend={{
              direction: salesTrendPct > 0 ? "up" : salesTrendPct < 0 ? "down" : "none",
              percent: Math.abs(salesTrendPct),
            }}
            footer="vs bulan lalu"
          />
          <StatCard
            icon={TrendingUp}
            label="Profit Estimasi"
            value={profitBulanIni}
            isMoney
            trend={{
              direction: profitTrendPct > 0 ? "up" : profitTrendPct < 0 ? "down" : "none",
              percent: Math.abs(profitTrendPct),
            }}
            footer="vs bulan lalu"
          />
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
              <CardTitle>Penjualan per Channel (Bulan Ini)</CardTitle>
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
                <p className="text-sm text-muted">Belum ada penjualan bulan ini.</p>
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
