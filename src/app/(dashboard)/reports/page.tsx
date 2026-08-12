import Link from "next/link";
import { Suspense } from "react";
import { Wallet, ShoppingBag, Clock, TrendingUp, Star } from "lucide-react";
import { endOfMonth, format, startOfMonth, subDays, subMonths } from "date-fns";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/stats/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelTrendChart } from "@/components/dashboard/channel-trend-chart";
import { ExportPdfButton } from "@/components/shared/export-pdf-button";
import { formatDateLong } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getSaldoKas,
  getPenjualanPeriode,
  getUangBelumCair,
  getProfitEstimasi,
  getTopProduk,
  getRevenueTrendByChannel,
  getPnLSummary,
  getPerChannelReport,
  getPerProductReport,
  getCashFlowReport,
  getPerTailorReport,
  getAgingPayoutReport,
} from "@/lib/reports";
import { ReportTabs } from "./report-tabs";

export const dynamic = "force-dynamic";

const VIEWS = [
  { value: "simple", label: "Laporan Sederhana" },
  { value: "detailed", label: "Laporan Lengkap" },
];

const PERIODS = [
  { value: "7", label: "7 Hari" },
  { value: "30", label: "30 Hari" },
  { value: "90", label: "90 Hari" },
  { value: "mtd", label: "Bulan Ini" },
  { value: "ltm", label: "12 Bulan Terakhir" },
];

function resolvePeriod(period: string) {
  const now = new Date();
  if (period === "mtd") return { start: startOfMonth(now), end: endOfMonth(now) };
  if (period === "ltm") return { start: subMonths(now, 12), end: now };
  const days = Number(period) || 30;
  return { start: subDays(now, days - 1), end: now };
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-card bg-black/5" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-card bg-black/5" />
    </div>
  );
}

async function SimpleReport() {
  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const trendStart = format(subDays(now, 29), "yyyy-MM-dd");
  const trendEnd = format(now, "yyyy-MM-dd");

  const [saldoKas, penjualanBulanIni, uangBelumCair, profitEstimasi, topProduk, trend] =
    await Promise.all([
      getSaldoKas(),
      getPenjualanPeriode(monthStart, monthEnd),
      getUangBelumCair(),
      getProfitEstimasi(monthStart, monthEnd),
      getTopProduk(monthStart, monthEnd, 1),
      getRevenueTrendByChannel(trendStart, trendEnd),
    ]);

  const topProductLabel = topProduk[0]?.name ?? "-";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Per {formatDateLong(now)}</p>
        <div className="no-print">
          <ExportPdfButton />
        </div>
      </div>

      <div className="print-area space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={Wallet} label="Saldo Kas" value={saldoKas} isMoney />
          <StatCard icon={ShoppingBag} label="Penjualan Bulan Ini" value={penjualanBulanIni} isMoney />
          <StatCard icon={Clock} label="Uang Belum Cair" value={uangBelumCair} isMoney />
          <StatCard icon={TrendingUp} label="Profit Estimasi" value={profitEstimasi} isMoney />
          <StatCard icon={Star} label="Top Produk" value={topProductLabel} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Penjualan 30 Hari Terakhir per Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <ChannelTrendChart channelNames={trend.channelNames} data={trend.data} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function DetailedReportContent({ period }: { period: string }) {
  const { start, end } = resolvePeriod(period);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  const [pnl, perChannel, perProduct, cashFlow, perTailor, aging] = await Promise.all([
    getPnLSummary(startStr, endStr),
    getPerChannelReport(startStr, endStr),
    getPerProductReport(startStr, endStr),
    getCashFlowReport(startStr, endStr),
    getPerTailorReport(startStr, endStr),
    getAgingPayoutReport(),
  ]);

  return (
    <ReportTabs
      pnl={pnl}
      perChannel={perChannel}
      perProduct={perProduct}
      cashFlow={cashFlow}
      perTailor={perTailor}
      aging={aging}
    />
  );
}

function DetailedReport({ period }: { period: string }) {
  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-black/5 p-1">
        {PERIODS.map((p) => (
          <Link
            key={p.value}
            href={`/reports?view=detailed&period=${p.value}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              period === p.value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
            )}
          >
            {p.label}
          </Link>
        ))}
      </div>

      <Suspense key={period} fallback={<ReportSkeleton />}>
        <DetailedReportContent period={period} />
      </Suspense>
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; period?: string }>;
}) {
  const { view = "simple", period = "30" } = await searchParams;
  const activeView = view === "detailed" ? "detailed" : "simple";

  return (
    <>
      <Header
        title="Laporan"
        subtitle="Laporan sederhana untuk ringkasan cepat, laporan lengkap untuk detail per channel/produk/penjahit."
      />

      <main className="flex-1 space-y-4 p-6">
        <div className="inline-flex items-center gap-1 rounded-lg bg-black/5 p-1">
          {VIEWS.map((v) => (
            <Link
              key={v.value}
              href={`/reports?view=${v.value}`}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium",
                activeView === v.value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              )}
            >
              {v.label}
            </Link>
          ))}
        </div>

        {activeView === "simple" ? (
          <Suspense fallback={<ReportSkeleton />}>
            <SimpleReport />
          </Suspense>
        ) : (
          <DetailedReport period={period} />
        )}
      </main>
    </>
  );
}
