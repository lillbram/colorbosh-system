import Link from "next/link";
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
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "aktif" } = await searchParams;
  const activeTab = status === "dibatalkan" || status === "retur" ? status : "aktif";

  const whereClause =
    activeTab === "dibatalkan"
      ? eq(salesEntries.isDeleted, true)
      : activeTab === "retur"
        ? eq(salesEntries.isReturned, true)
        : and(eq(salesEntries.isDeleted, false), eq(salesEntries.isReturned, false));

  const rows = await db
    .select({
      id: salesEntries.id,
      entryDate: salesEntries.entryDate,
      qty: salesEntries.qty,
      grossAmount: salesEntries.grossAmount,
      netExpected: salesEntries.netExpected,
      source: salesEntries.source,
      returnNote: salesEntries.returnNote,
      channelName: channels.name,
      productName: products.name,
    })
    .from(salesEntries)
    .leftJoin(channels, eq(salesEntries.channelId, channels.id))
    .leftJoin(products, eq(salesEntries.productId, products.id))
    .where(whereClause)
    .orderBy(desc(salesEntries.entryDate))
    .limit(200);

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

        <div className="inline-flex items-center gap-1 rounded-lg bg-black/5 p-1">
          {TABS.map((t) => (
            <Link
              key={t.value}
              href={t.value === "aktif" ? "/sales" : `/sales?status=${t.value}`}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium",
                activeTab === t.value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              )}
            >
              {t.label}
            </Link>
          ))}
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
                  <TableHead>Channel</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Bruto</TableHead>
                  <TableHead>Bersih</TableHead>
                  <TableHead>Sumber</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  {activeTab === "aktif" && <TableHead className="w-32" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.entryDate)}</TableCell>
                    <TableCell>{r.channelName ?? "-"}</TableCell>
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
              </TableBody>
            </Table>
          )}
        </Card>
      </main>
    </>
  );
}
