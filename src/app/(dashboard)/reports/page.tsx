import Link from "next/link";
import { Suspense } from "react";
import { Wallet, ShoppingBag, Receipt, TrendingUp, Star } from "lucide-react";
import { endOfMonth, format, parseISO, startOfMonth, subDays, subMonths } from "date-fns";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/stats/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelTrendChart } from "@/components/dashboard/channel-trend-chart";
import { ExportPdfButton } from "@/components/shared/export-pdf-button";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { MonthPicker } from "@/components/shared/month-picker";
import { formatDate, formatDateLong, formatIDR, lastRecordedNote } from "@/lib/format";
import { getCurrentRole } from "@/lib/auth";
import { isValidMonth, monthLabel, monthRange, recentMonths, todayJakarta } from "@/lib/period";
import { cn } from "@/lib/utils";
import {
  getSaldoKas,
  getPenjualanPeriode,
  getProfitEstimasi,
  getTopProduk,
  getRevenueTrendByChannel,
  getPnLSummary,
  getPerChannelReport,
  getPerProductReport,
  getCashFlowReport,
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

const SIMPLE_PERIODS = [
  { value: "today", label: "Hari Ini" },
  { value: "7", label: "7 Hari" },
  { value: "30", label: "30 Hari" },
  { value: "mtd", label: "Bulan Ini" },
];

function resolvePeriod(period: string, month?: string) {
  if (isValidMonth(month)) {
    const r = monthRange(month);
    return { start: parseISO(r.start), end: parseISO(r.end) };
  }
  const now = parseISO(todayJakarta());
  if (period === "today") return { start: now, end: now };
  if (period === "mtd") return { start: startOfMonth(now), end: endOfMonth(now) };
  if (period === "ltm") return { start: subMonths(now, 12), end: now };
  const days = Number(period) || 30;
  return { start: subDays(now, days - 1), end: now };
}

function periodLabel(period: string, start: Date, end: Date, month?: string) {
  if (isValidMonth(month)) return `${monthLabel(month)} — ${formatDate(start)} s/d ${formatDate(end)}`;
  if (period === "today") return `Hari ini, ${formatDateLong(end)}`;
  if (period === "mtd") return `Bulan ini — ${formatDate(start)} s/d ${formatDate(end)}`;
  return `${formatDate(start)} s/d ${formatDate(end)}`;
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

async function SimpleReportContent({
  period,
  month,
  isOwner,
}: {
  period: string;
  month?: string;
  isOwner: boolean;
}) {
  const { start, end } = resolvePeriod(period, month);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const trendEnd = todayJakarta();
  const trendStart = format(subDays(parseISO(trendEnd), 29), "yyyy-MM-dd");

  const [saldoKas, penjualanPeriode, profitEstimasi, topProdukList, trend, perChannel, pnl] =
    await Promise.all([
      getSaldoKas(),
      getPenjualanPeriode(startStr, endStr),
      isOwner ? getProfitEstimasi(startStr, endStr) : Promise.resolve(0),
      getTopProduk(startStr, endStr, 5),
      getRevenueTrendByChannel(trendStart, trendEnd),
      getPerChannelReport(startStr, endStr),
      isOwner ? getPnLSummary(startStr, endStr) : Promise.resolve(null),
    ]);

  const topProductLabel = topProdukList[0]?.name ?? "-";
  const totalTransaksi = perChannel.reduce((sum, c) => sum + c.transaksi, 0);
  const maxChannelGross = Math.max(1, ...perChannel.map((c) => c.gross));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{periodLabel(period, start, end, month)}</p>
        <div className="no-print">
          <ExportPdfButton />
        </div>
      </div>

      <div className="print-area space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={Wallet}
            label="Saldo Kas"
            value={saldoKas.saldo}
            isMoney
            note={lastRecordedNote(saldoKas.lastTxnDate, todayJakarta())}
            info="Saldo awal semua akun (bank/tunai/e-wallet) ditambah semua Uang Masuk, dikurangi semua Uang Keluar yang sudah tercatat di Arus Kas."
          />
          <StatCard
            icon={ShoppingBag}
            label="Total Penjualan"
            value={penjualanPeriode}
            isMoney
            info="Total Bruto (sebelum potongan fee platform & diskon) semua penjualan aktif pada periode terpilih, dari semua channel. Order yang dibatalkan atau diretur tidak dihitung."
          />
          <StatCard
            icon={Receipt}
            label="Total Transaksi"
            value={totalTransaksi}
            info="Jumlah baris penjualan aktif pada periode terpilih, dari semua channel."
          />
          {isOwner && (
          <StatCard
            icon={TrendingUp}
            label="Laba Bersih"
            value={profitEstimasi}
            isMoney
            info="Penjualan Bersih dikurangi HPP produk yang terjual, rugi retur, dan biaya operasional pada periode terpilih. Angka yang sama dengan baris Laba Bersih di Laporan Lengkap → P&L. Bukan sekadar uang masuk dikurangi uang keluar."
          />
          )}
          <StatCard
            icon={Star}
            label="Top Produk"
            value={topProductLabel}
            info="Produk dengan Total Bruto tertinggi dari semua penjualan aktif pada periode terpilih."
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Penjualan 30 Hari Terakhir per Channel
              <InfoTooltip>
                Total Bruto penjualan aktif per hari, dikelompokkan per channel, untuk 30 hari
                terakhir sampai hari ini — selalu 30 hari, tidak mengikuti filter periode di atas.
              </InfoTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChannelTrendChart channelNames={trend.channelNames} data={trend.data} />
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Rincian per Channel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {perChannel.length === 0 ? (
                <p className="text-sm text-muted">Belum ada penjualan pada periode ini.</p>
              ) : (
                perChannel.map((c) => (
                  <div key={c.name}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-ink">{c.name}</span>
                      <span className="font-mono-num text-sm font-semibold text-ink">
                        {formatIDR(c.gross)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{ width: `${(c.gross / maxChannelGross) * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted">{c.transaksi} transaksi</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Produk Terlaris</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topProdukList.length === 0 ? (
                <p className="text-sm text-muted">Belum ada penjualan pada periode ini.</p>
              ) : (
                topProdukList.map((p, i) => (
                  <div key={p.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xs font-semibold text-primary-600">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-ink">{p.name}</p>
                        <p className="text-xs text-muted">{p.qty} terjual</p>
                      </div>
                    </div>
                    <span className="font-mono-num text-sm font-semibold text-ink">
                      {formatIDR(p.revenue)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {pnl && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                Ringkasan Laba Rugi
                <InfoTooltip>
                  Ringkasan cepat untuk periode terpilih — lihat tab P&amp;L di Laporan Lengkap untuk
                  rincian per channel dan export.
                </InfoTooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border/70 text-sm">
                <div className="flex justify-between py-2">
                  <span className="text-muted">Total Penjualan</span>
                  <span className="font-mono-num">{formatIDR(pnl.totalPenjualan)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted">Diskon</span>
                  <span className="font-mono-num text-danger">-{formatIDR(pnl.totalDiskon)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted">Fee Platform Estimasi</span>
                  <span className="font-mono-num text-danger">-{formatIDR(pnl.totalFeePlatform)}</span>
                </div>
                <div className="flex justify-between py-2 font-medium">
                  <span>Penjualan Bersih</span>
                  <span className="font-mono-num">{formatIDR(pnl.totalBersih)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted">HPP</span>
                  <span className="font-mono-num text-danger">-{formatIDR(pnl.hpp)}</span>
                </div>
                <div className="flex justify-between py-2 font-medium">
                  <span>Laba Kotor</span>
                  <span className="font-mono-num">{formatIDR(pnl.labaKotor)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted">Rugi Retur</span>
                  <span className="font-mono-num text-danger">-{formatIDR(pnl.rugiRetur)}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted">Operasional</span>
                  <span className="font-mono-num text-danger">-{formatIDR(pnl.totalOperasional)}</span>
                </div>
                <div className="flex justify-between pt-3 text-base font-bold">
                  <span>Laba Bersih</span>
                  <span
                    className={cn("font-mono-num", pnl.labaBersih >= 0 ? "text-success" : "text-danger")}
                  >
                    {formatIDR(pnl.labaBersih)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function SimpleReport({
  period,
  month,
  isOwner,
}: {
  period: string;
  month?: string;
  isOwner: boolean;
}) {
  const activeMonth = isValidMonth(month) ? month : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-black/5 p-1">
          {SIMPLE_PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`/reports?view=simple&speriod=${p.value}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                !activeMonth && period === p.value
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <MonthPicker
          basePath="/reports"
          params={{ view: "simple" }}
          months={recentMonths()}
          value={activeMonth}
        />
      </div>

      <Suspense key={`${period}-${activeMonth}`} fallback={<ReportSkeleton />}>
        <SimpleReportContent period={period} month={activeMonth ?? undefined} isOwner={isOwner} />
      </Suspense>
    </div>
  );
}

async function DetailedReportContent({ period, month }: { period: string; month?: string }) {
  const { start, end } = resolvePeriod(period, month);
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  const [pnl, perChannel, perProduct, cashFlow] = await Promise.all([
    getPnLSummary(startStr, endStr),
    getPerChannelReport(startStr, endStr),
    getPerProductReport(startStr, endStr),
    getCashFlowReport(startStr, endStr),
  ]);

  return (
    <ReportTabs pnl={pnl} perChannel={perChannel} perProduct={perProduct} cashFlow={cashFlow} />
  );
}

function DetailedReport({ period, month }: { period: string; month?: string }) {
  const activeMonth = isValidMonth(month) ? month : null;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-black/5 p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`/reports?view=detailed&period=${p.value}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                !activeMonth && period === p.value
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
        <MonthPicker
          basePath="/reports"
          params={{ view: "detailed" }}
          months={recentMonths()}
          value={activeMonth}
        />
      </div>

      <Suspense key={`${period}-${activeMonth}`} fallback={<ReportSkeleton />}>
        <DetailedReportContent period={period} month={activeMonth ?? undefined} />
      </Suspense>
    </div>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; period?: string; speriod?: string; month?: string }>;
}) {
  const { view = "simple", period = "30", speriod = "today", month } = await searchParams;
  const isOwner = (await getCurrentRole()) === "owner";
  // Laporan Lengkap (P&L, HPP & profit per produk) is owner-only.
  const activeView = view === "detailed" && isOwner ? "detailed" : "simple";
  const visibleViews = isOwner ? VIEWS : VIEWS.filter((v) => v.value === "simple");

  return (
    <>
      <Header
        title="Laporan"
        subtitle="Laporan sederhana untuk ringkasan cepat, laporan lengkap untuk detail per channel/produk."
      />

      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="inline-flex items-center gap-1 rounded-lg bg-black/5 p-1">
          {visibleViews.map((v) => (
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
          <SimpleReport period={speriod} month={month} isOwner={isOwner} />
        ) : (
          <DetailedReport period={period} month={month} />
        )}
      </main>
    </>
  );
}
