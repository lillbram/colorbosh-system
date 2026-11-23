import { desc, eq } from "drizzle-orm";
import { Banknote, Boxes, Landmark, Scale, Store } from "lucide-react";
import { db } from "@/db";
import { channels, marketplaceBalanceSnapshots, settings } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/stats/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CapitalTrendChart } from "@/components/dashboard/capital-trend-chart";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { requireRole } from "@/lib/auth";
import { getCapitalTrend, getPnL, getWorkingCapital } from "@/lib/finance";
import { formatDate, formatIDR } from "@/lib/format";
import { monthToDate, todayJakarta } from "@/lib/period";
import { deleteMarketplaceSnapshot } from "./actions";
import { SnapshotDialog } from "./snapshot-dialog";

export const dynamic = "force-dynamic";

export default async function CapitalPage() {
  await requireRole("owner");
  const today = todayJakarta();
  const mtd = monthToDate();

  const [capital, trend, channelList, snapshots, [cfg], pnl] = await Promise.all([
    getWorkingCapital(today),
    getCapitalTrend(12),
    db.select({ id: channels.id, name: channels.name }).from(channels).orderBy(channels.name),
    db
      .select({
        id: marketplaceBalanceSnapshots.id,
        date: marketplaceBalanceSnapshots.snapshotDate,
        awaiting: marketplaceBalanceSnapshots.awaitingDelivery,
        processing: marketplaceBalanceSnapshots.settlementProcessing,
        refund: marketplaceBalanceSnapshots.refundProcessing,
        note: marketplaceBalanceSnapshots.note,
        channelName: channels.name,
      })
      .from(marketplaceBalanceSnapshots)
      .leftJoin(channels, eq(marketplaceBalanceSnapshots.channelId, channels.id))
      .orderBy(desc(marketplaceBalanceSnapshots.snapshotDate))
      .limit(15),
    db.select().from(settings).where(eq(settings.id, 1)),
    getPnL(mtd.start, mtd.end),
  ]);
  const returnReserve = Math.max(0, pnl.labaBersih) * (Number(cfg?.returnReservePct ?? 0) / 100);
  const capitalReserve = Math.max(0, pnl.labaBersih) * (Number(cfg?.capitalReservePct ?? 0) / 100);

  return (
    <>
      <Header title="Modal Berjalan" subtitle="Berapa uang usaha yang sebenarnya berputar sekarang." />

      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard icon={Landmark} label="Kas Bank" value={capital.bank} isMoney />
          <StatCard
            icon={Store}
            label="Saldo Marketplace"
            value={capital.marketplace}
            isMoney
            info="Menunggu paket diterima + penyelesaian diproses dari catatan terakhir tiap channel. Pengembalian diproses tidak dihitung."
          />
          <StatCard
            icon={Boxes}
            label="Nilai Stok"
            value={capital.stockValue}
            isMoney
            info="Stok × HPP tiap produk (halaman Stok)."
          />
          <StatCard
            icon={Banknote}
            label="Sisa Gaji"
            value={capital.salaryRemaining}
            isMoney
            info="Hak gaji yang belum dibayar, semua bulan (halaman Gaji). Dikurangkan dari modal."
          />
          <StatCard icon={Scale} label="Modal Berjalan" value={capital.total} isMoney />
        </div>

        {(returnReserve > 0 || capitalReserve > 0) && (
          <Card className="p-4 text-sm text-muted">
            Cadangan bulan ini (dari Laba Bersih, hanya info — tidak mengurangi angka di atas):
            {returnReserve > 0 && <span className="ml-2">retur {formatIDR(returnReserve)}</span>}
            {capitalReserve > 0 && <span className="ml-2">modal {formatIDR(capitalReserve)}</span>}
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              Tren Mingguan (12 minggu)
              <InfoTooltip>
                Kas bank + saldo marketplace + nilai stok pada tiap akhir minggu. Sisa gaji tidak dikurangkan di
                grafik ini.
              </InfoTooltip>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CapitalTrendChart data={trend} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Catatan Saldo Marketplace</CardTitle>
            <SnapshotDialog channels={channelList} today={today} />
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshots.length === 0 ? (
              <p className="text-sm text-muted">Belum ada catatan. Catat saldo dari Seller Center secara berkala.</p>
            ) : (
              snapshots.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {s.channelName ?? "-"} · {formatDate(s.date)}
                    </p>
                    <p className="font-mono-num text-xs text-muted">
                      Menunggu {formatIDR(Number(s.awaiting))} · Diproses {formatIDR(Number(s.processing))} · Refund{" "}
                      {formatIDR(Number(s.refund))}
                    </p>
                    {s.note && <p className="text-xs text-muted">{s.note}</p>}
                  </div>
                  <ConfirmDeleteButton itemName="catatan ini" onConfirm={deleteMarketplaceSnapshot.bind(null, s.id)} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
