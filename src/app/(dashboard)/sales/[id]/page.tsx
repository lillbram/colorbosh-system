import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { salesEntries, channels, products, users } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmCancelButton } from "@/components/shared/confirm-cancel-button";
import { formatDate, formatIDR } from "@/lib/format";
import { cancelSalesEntry } from "../actions";

export const dynamic = "force-dynamic";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Manual",
  csv_import: "Impor CSV",
  live_bulk: "Rekap Live",
  pos: "Kasir (POS)",
};

export default async function SalesEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [entry] = await db
    .select({
      id: salesEntries.id,
      entryDate: salesEntries.entryDate,
      qty: salesEntries.qty,
      grossAmount: salesEntries.grossAmount,
      discount: salesEntries.discount,
      platformFeeEst: salesEntries.platformFeeEst,
      netExpected: salesEntries.netExpected,
      orderRef: salesEntries.orderRef,
      buyerNote: salesEntries.buyerNote,
      source: salesEntries.source,
      isDeleted: salesEntries.isDeleted,
      createdAt: salesEntries.createdAt,
      channelName: channels.name,
      productName: products.name,
      productSku: products.sku,
      createdByName: users.name,
    })
    .from(salesEntries)
    .leftJoin(channels, eq(salesEntries.channelId, channels.id))
    .leftJoin(products, eq(salesEntries.productId, products.id))
    .leftJoin(users, eq(salesEntries.createdBy, users.id))
    .where(eq(salesEntries.id, id));

  if (!entry) notFound();

  const gross = Number(entry.grossAmount);
  const discount = Number(entry.discount ?? 0);
  const fee = Number(entry.platformFeeEst ?? 0);
  const net = Number(entry.netExpected);
  const unitPrice = entry.qty > 0 ? gross / entry.qty : 0;
  const appliedFeePct = gross > 0 ? (fee / gross) * 100 : 0;

  return (
    <>
      <Header
        title={entry.productName ?? "Detail Penjualan"}
        subtitle={entry.orderRef ? `No. Order ${entry.orderRef}` : entry.channelName ?? "-"}
      />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={entry.isDeleted ? "danger" : "success"}>
              {entry.isDeleted ? "Dibatalkan" : "Aktif"}
            </Badge>
            <Badge variant="neutral">{SOURCE_LABEL[entry.source ?? "manual"]}</Badge>
          </div>
          {!entry.isDeleted && (
            <ConfirmCancelButton
              itemName="penjualan ini"
              onConfirm={cancelSalesEntry.bind(null, entry.id)}
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5">
            <p className="text-sm text-muted">Tanggal</p>
            <p className="mt-1 text-sm font-semibold text-ink">{formatDate(entry.entryDate)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted">Channel</p>
            <p className="mt-1 text-sm font-semibold text-ink">{entry.channelName ?? "-"}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted">Produk</p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {entry.productName ?? "-"}
              {entry.productSku && <span className="text-muted"> ({entry.productSku})</span>}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted">Qty</p>
            <p className="font-mono-num mt-1 text-xl font-bold text-ink">{entry.qty}</p>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rincian Harga</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Harga Satuan</span>
              <span className="font-mono-num text-ink">{formatIDR(unitPrice)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Total Bruto</span>
              <span className="font-mono-num text-ink">{formatIDR(gross)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Diskon</span>
              <span className="font-mono-num text-danger">
                {discount > 0 ? `- ${formatIDR(discount)}` : formatIDR(0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">
                Fee Platform{gross > 0 ? ` (${appliedFeePct.toFixed(1)}%)` : ""}
              </span>
              <span className="font-mono-num text-danger">
                {fee > 0 ? `- ${formatIDR(fee)}` : formatIDR(0)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
              <span className="text-ink">Total Bersih</span>
              <span className="font-mono-num text-lg text-ink">{formatIDR(net)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Info Lain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">No. Order</span>
              <span className="text-ink">{entry.orderRef ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Catatan Pembeli</span>
              <span className="text-ink">{entry.buyerNote ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Dicatat oleh</span>
              <span className="text-ink">{entry.createdByName ?? "-"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Dicatat pada</span>
              <span className="text-ink">
                {entry.createdAt ? formatDate(entry.createdAt) : "-"}
              </span>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
