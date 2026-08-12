import { Wallet, ShoppingBag, Clock, TrendingUp, Star } from "lucide-react";
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
  getUangBelumCair,
  getProfitEstimasi,
  getTopProduk,
  getMonthlyRevenueTrend,
  getChannelBreakdown,
  getDashboardHighlights,
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
    uangBelumCair,
    profitBulanIni,
    profitBulanLalu,
    topProduk,
    monthlyTrend,
    channelBreakdown,
    highlights,
  ] = await Promise.all([
    getSaldoKas(),
    getPenjualanPeriode(monthStart, monthEnd),
    getPenjualanPeriode(prevMonthStart, prevMonthEnd),
    getUangBelumCair(),
    getProfitEstimasi(monthStart, monthEnd),
    getProfitEstimasi(prevMonthStart, prevMonthEnd),
    getTopProduk(monthStart, monthEnd, 3),
    getMonthlyRevenueTrend(7),
    getChannelBreakdown(monthStart, monthEnd),
    getDashboardHighlights(),
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
      <Header title="Ringkasan Bisnis" subtitle="Pantau kas, penjualan, dan pencairan dana." />

      <main className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            icon={Clock}
            label="Uang Belum Cair"
            value={uangBelumCair}
            isMoney
            trend={{ direction: "none", percent: 0 }}
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
              <CardTitle>Sorotan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {highlights.topOutstanding ? (
                <div className="rounded-lg bg-canvas p-3">
                  <p className="text-sm font-medium text-ink">
                    {highlights.topOutstanding.channelName} belum cair
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {formatIDR(highlights.topOutstanding.amount)} belum diterima
                    {highlights.topOutstanding.oldestUnpaidDays !== null &&
                    highlights.topOutstanding.oldestUnpaidDays > 0
                      ? ` — tertua ${highlights.topOutstanding.oldestUnpaidDays} hari`
                      : ""}
                    .
                  </p>
                </div>
              ) : (
                <div className="rounded-lg bg-canvas p-3">
                  <p className="text-sm font-medium text-ink">Semua channel lunas</p>
                  <p className="mt-1 text-sm text-muted">
                    Tidak ada saldo yang masih belum cair saat ini.
                  </p>
                </div>
              )}

              {highlights.overdueTerminCount > 0 && (
                <div className="rounded-lg bg-warning/10 p-3">
                  <p className="text-sm font-medium text-warning">Termin Penjahit Jatuh Tempo</p>
                  <p className="mt-1 text-sm text-muted">
                    {highlights.overdueTerminCount} pembayaran termin sudah lewat jatuh tempo.
                  </p>
                </div>
              )}

              {highlights.overduePoCount > 0 && (
                <div className="rounded-lg bg-danger/10 p-3">
                  <p className="text-sm font-medium text-danger">Pemesanan Kain Perlu Perhatian</p>
                  <p className="mt-1 text-sm text-muted">
                    {highlights.overduePoCount} PO melewati estimasi tanggal tiba.
                  </p>
                </div>
              )}
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
