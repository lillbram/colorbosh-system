import Link from "next/link";
import { Fragment } from "react";
import { ShoppingBag, Radio, Upload, PencilLine, ShoppingCart } from "lucide-react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { salesEntries, channels, products } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmCancelButton } from "@/components/shared/confirm-cancel-button";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { formatDate, formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { cancelSalesEntry } from "./actions";
import { ReturnSalesEntryDialog } from "./return-sales-entry-dialog";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  csv_import: "Impor CSV",
  live_bulk: "Rekap Live",
  pos: "Kasir (POS)",
};

const TABS = [
  { value: "aktif", label: "Aktif" },
  { value: "retur", label: "Retur" },
  { value: "dibatalkan", label: "Dibatalkan" },
];

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; channel?: string }>;
}) {
  const { status = "aktif", channel: channelFilter } = await searchParams;
  const activeTab = status === "dibatalkan" || status === "retur" ? status : "aktif";

  const statusClause =
    activeTab === "dibatalkan"
      ? eq(salesEntries.isDeleted, true)
      : activeTab === "retur"
        ? eq(salesEntries.isReturned, true)
        : and(eq(salesEntries.isDeleted, false), eq(salesEntries.isReturned, false));
  const whereClause = channelFilter
    ? and(statusClause, eq(salesEntries.channelId, channelFilter))
    : statusClause;

  const [rows, channelList] = await Promise.all([
    db
      .select({
        id: salesEntries.id,
        entryDate: salesEntries.entryDate,
        qty: salesEntries.qty,
        grossAmount: salesEntries.grossAmount,
        netExpected: salesEntries.netExpected,
        source: salesEntries.source,
        returnNote: salesEntries.returnNote,
        channelId: salesEntries.channelId,
        channelName: channels.name,
        productName: products.name,
        hppTarget: products.hppTarget,
      })
      .from(salesEntries)
      .leftJoin(channels, eq(salesEntries.channelId, channels.id))
      .leftJoin(products, eq(salesEntries.productId, products.id))
      .where(whereClause)
      .orderBy(desc(salesEntries.entryDate)),
    db.select({ id: channels.id, name: channels.name }).from(channels).orderBy(channels.name),
  ]);

  // Group by channel so totals here can be matched against the same
  // channel groupings in Pencairan Dana and Laporan Lengkap → Per Channel.
  const groups = new Map<
    string,
    { channelId: string | null; channelName: string; rows: typeof rows; gross: number; bersih: number; profit: number }
  >();
  for (const r of rows) {
    const key = r.channelId ?? "none";
    const g = groups.get(key) ?? {
      channelId: r.channelId,
      channelName: r.channelName ?? "Tanpa Channel",
      rows: [],
      gross: 0,
      bersih: 0,
      profit: 0,
    };
    g.rows.push(r);
    g.gross += Number(r.grossAmount);
    g.bersih += Number(r.netExpected);
    g.profit += Number(r.netExpected) - Number(r.hppTarget ?? 0) * r.qty;
    groups.set(key, g);
  }
  const groupedRows = Array.from(groups.values()).sort((a, b) => b.gross - a.gross);

  const overallSummary = groupedRows.reduce(
    (acc, g) => ({
      transaksi: acc.transaksi + g.rows.length,
      gross: acc.gross + g.gross,
      bersih: acc.bersih + g.bersih,
      profit: acc.profit + g.profit,
    }),
    { transaksi: 0, gross: 0, bersih: 0, profit: 0 }
  );

  function buildUrl(overrides: { status?: string; channel?: string }) {
    const params = new URLSearchParams();
    const nextStatus = overrides.status ?? activeTab;
    const nextChannel = "channel" in overrides ? overrides.channel : channelFilter;
    if (nextStatus !== "aktif") params.set("status", nextStatus);
    if (nextChannel) params.set("channel", nextChannel);
    const qs = params.toString();
    return qs ? `/sales?${qs}` : "/sales";
  }

  return (
    <>
      <Header
        title="Penjualan"
        subtitle="Rekap penjualan dari TikTok Live, TikTok Shop, dan Shopee. Bingung dengan impor file? Coba Kasir (POS)."
      />

      <main className="flex-1 space-y-4 p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link href="/sales/new/pos">
            <Card className="flex h-full items-center gap-3 border-primary-200 bg-primary-50/40 p-4 transition-shadow hover:shadow-md">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary-500">
                <ShoppingCart className="size-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Kasir (POS)</p>
                <p className="text-xs text-muted">Klik produk, langsung tersimpan</p>
              </div>
            </Card>
          </Link>
          <Link href="/sales/new/live">
            <Card className="flex h-full items-center gap-3 p-4 transition-shadow hover:shadow-md">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary-50">
                <Radio className="size-5 text-primary-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Rekap Live</p>
                <p className="text-xs text-muted">Input massal sesi live</p>
              </div>
            </Card>
          </Link>
          <Link href="/sales/new/import">
            <Card className="flex h-full items-center gap-3 p-4 transition-shadow hover:shadow-md">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary-50">
                <Upload className="size-5 text-primary-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Impor CSV</p>
                <p className="text-xs text-muted">Unggah export dari TikTok/Shopee</p>
              </div>
            </Card>
          </Link>
          <Link href="/sales/new/single">
            <Card className="flex h-full items-center gap-3 p-4 transition-shadow hover:shadow-md">
              <div className="flex size-10 items-center justify-center rounded-full bg-primary-50">
                <PencilLine className="size-5 text-primary-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink">Input Manual</p>
                <p className="text-xs text-muted">Order sporadis atau koreksi</p>
              </div>
            </Card>
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 rounded-lg bg-black/5 p-1">
            {TABS.map((t) => (
              <Link
                key={t.value}
                href={buildUrl({ status: t.value })}
                className={cn(
                  "rounded-md px-4 py-1.5 text-sm font-medium",
                  activeTab === t.value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>
          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-black/5 p-1">
            <Link
              href={buildUrl({ channel: undefined })}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                !channelFilter ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              )}
            >
              Semua Channel
            </Link>
            {channelList.map((c) => (
              <Link
                key={c.id}
                href={buildUrl({ channel: c.id })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium",
                  channelFilter === c.id ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                )}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </div>

        {rows.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Semua Channel"
              transaksi={overallSummary.transaksi}
              gross={overallSummary.gross}
              bersih={overallSummary.bersih}
              profit={overallSummary.profit}
              highlight
            />
            {groupedRows.map((g) => (
              <SummaryCard
                key={g.channelId ?? "none"}
                title={g.channelName}
                transaksi={g.rows.length}
                gross={g.gross}
                bersih={g.bersih}
                profit={g.profit}
              />
            ))}
          </div>
        )}

        <div className="flex items-center gap-1.5 px-1 text-xs text-muted">
          <span>Dikelompokkan per channel supaya mudah dicocokkan dengan Pencairan Dana & Laporan.</span>
          <InfoTooltip>
            Tiap channel di sini menjumlahkan SEMUA transaksi pada tab & filter aktif saat ini
            (tidak dibatasi periode tanggal) — beda dengan Laporan Lengkap yang dibatasi periode
            filter di sana, dan beda dengan Pencairan Dana yang memakai Bersih (Total Terjual)
            bukan Bruto. Untuk mencocokkan persis, bandingkan Bersih di sini dengan kolom Bersih
            di Laporan Lengkap → Per Channel pada periode yang sama.
          </InfoTooltip>
        </div>

        <Card>
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={ShoppingBag}
                title={
                  activeTab === "dibatalkan"
                    ? "Belum ada penjualan dibatalkan"
                    : activeTab === "retur"
                      ? "Belum ada retur"
                      : "Belum ada penjualan"
                }
                description={
                  activeTab === "dibatalkan"
                    ? "Order yang dibatalkan akan muncul di sini."
                    : activeTab === "retur"
                      ? "Order yang ditandai retur akan muncul di sini."
                      : "Mulai catat penjualan lewat Kasir (POS), Rekap Live, Impor CSV, atau Input Manual."
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Bruto</TableHead>
                  <TableHead>Bersih</TableHead>
                  <TableHead>HPP</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Sumber</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  {activeTab === "aktif" && <TableHead className="w-32" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedRows.map((g) => (
                  <Fragment key={g.channelId ?? "none"}>
                    <TableRow className="bg-black/[0.03] hover:bg-black/[0.03]">
                      <TableCell
                        colSpan={activeTab === "aktif" ? 10 : 9}
                        className="py-2 text-sm font-semibold text-ink"
                      >
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>{g.channelName}</span>
                          <span className="text-xs font-normal text-muted">
                            {g.rows.length} transaksi
                          </span>
                          <span className="font-mono-num text-xs font-normal text-muted">
                            Bruto {formatIDR(g.gross)}
                          </span>
                          <span className="font-mono-num text-xs font-normal text-muted">
                            Bersih {formatIDR(g.bersih)}
                          </span>
                          <span
                            className={cn(
                              "font-mono-num text-xs font-normal",
                              g.profit < 0 ? "text-danger" : "text-success"
                            )}
                          >
                            Profit {formatIDR(g.profit)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                    {g.rows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDate(r.entryDate)}</TableCell>
                        <TableCell>
                          <Link href={`/sales/${r.id}`} className="font-medium text-primary-600 hover:underline">
                            {r.productName ?? "-"}
                          </Link>
                          {activeTab === "retur" && r.returnNote && (
                            <p className="mt-0.5 text-xs text-muted">{r.returnNote}</p>
                          )}
                        </TableCell>
                        <TableCell className="font-mono-num">{r.qty}</TableCell>
                        <TableCell className="font-mono-num">{formatIDR(Number(r.grossAmount))}</TableCell>
                        <TableCell className="font-mono-num">
                          {formatIDR(Number(r.netExpected))}
                        </TableCell>
                        <TableCell className="font-mono-num text-muted">
                          {formatIDR(Number(r.hppTarget ?? 0))}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "font-mono-num",
                            Number(r.netExpected) - Number(r.hppTarget ?? 0) * r.qty < 0
                              ? "text-danger"
                              : "text-success"
                          )}
                        >
                          {formatIDR(Number(r.netExpected) - Number(r.hppTarget ?? 0) * r.qty)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="neutral">{SOURCE_LABEL[r.source ?? "manual"]}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              activeTab === "dibatalkan" ? "danger" : activeTab === "retur" ? "warning" : "success"
                            }
                          >
                            {activeTab === "dibatalkan" ? "Dibatalkan" : activeTab === "retur" ? "Retur" : "Aktif"}
                          </Badge>
                        </TableCell>
                        {activeTab === "aktif" && (
                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <ReturnSalesEntryDialog entryId={r.id} size="icon" />
                              <ConfirmCancelButton
                                itemName="penjualan ini"
                                size="icon"
                                onConfirm={cancelSalesEntry.bind(null, r.id)}
                              />
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </main>
    </>
  );
}

function SummaryCard({
  title,
  transaksi,
  gross,
  bersih,
  profit,
  highlight = false,
}: {
  title: string;
  transaksi: number;
  gross: number;
  bersih: number;
  profit: number;
  highlight?: boolean;
}) {
  return (
    <Card className={cn("p-4", highlight && "border-primary-200 bg-primary-50/40")}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-ink">{title}</p>
        <Badge variant="neutral">{transaksi} transaksi</Badge>
      </div>
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted">Bruto</span>
          <span className="font-mono-num font-semibold text-ink">{formatIDR(gross)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted">Bersih</span>
          <span className="font-mono-num font-semibold text-ink">{formatIDR(bersih)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-muted">Profit</span>
          <span
            className={cn(
              "font-mono-num font-semibold",
              profit < 0 ? "text-danger" : "text-success"
            )}
          >
            {formatIDR(profit)}
          </span>
        </div>
      </div>
    </Card>
  );
}
