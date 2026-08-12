import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  purchaseOrders,
  purchaseOrderItems,
  purchaseOrderPayments,
  suppliers,
  accounts,
} from "@/db/schema";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate, formatIDR } from "@/lib/format";
import { ReceiveGoodsDialog } from "./receive-goods-dialog";
import { PaymentDialog } from "./payment-dialog";

export const dynamic = "force-dynamic";

const ITEM_TYPE_LABEL: Record<string, string> = {
  fabric_roll: "Kain Roll",
  accessory: "Hiasan",
  packaging: "Plastik Packing",
  other: "Lainnya",
};

const METHOD_LABEL: Record<string, string> = {
  transfer: "Transfer",
  cash: "Tunai",
  cod: "COD",
  other: "Lainnya",
};

export default async function ProcurementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [po] = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      orderDate: purchaseOrders.orderDate,
      expectedDate: purchaseOrders.expectedDate,
      actualArrivalDate: purchaseOrders.actualArrivalDate,
      status: purchaseOrders.status,
      totalAmount: purchaseOrders.totalAmount,
      notes: purchaseOrders.notes,
      supplierName: suppliers.name,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(eq(purchaseOrders.id, id));

  if (!po) notFound();

  const [items, payments, accountList] = await Promise.all([
    db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.poId, id)),
    db
      .select()
      .from(purchaseOrderPayments)
      .where(eq(purchaseOrderPayments.poId, id))
      .orderBy(purchaseOrderPayments.paymentDate),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.isActive, true)),
  ]);

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Number(po.totalAmount) - totalPaid;
  const canReceive = po.status === "ordered" || po.status === "partially_received";

  return (
    <>
      <Header title={po.poNumber} subtitle={po.supplierName ?? "-"} />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={po.status ?? "draft"} />
            <span className="text-sm text-muted">
              Dipesan {formatDate(po.orderDate)}
              {po.expectedDate && ` · Estimasi tiba ${formatDate(po.expectedDate)}`}
              {po.actualArrivalDate && ` · Tiba ${formatDate(po.actualArrivalDate)}`}
            </span>
          </div>
          <div className="flex gap-2">
            {canReceive && <ReceiveGoodsDialog poId={po.id} items={items} />}
            {remaining > 0 && po.status !== "cancelled" && (
              <PaymentDialog poId={po.id} accounts={accountList} remaining={remaining} />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm text-muted">Total Pesanan</p>
            <p className="font-mono-num mt-1 text-xl font-bold text-ink">
              {formatIDR(Number(po.totalAmount))}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted">Sudah Dibayar</p>
            <p className="font-mono-num mt-1 text-xl font-bold text-success">
              {formatIDR(totalPaid)}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted">Sisa Tagihan</p>
            <p className="font-mono-num mt-1 text-xl font-bold text-warning">
              {formatIDR(Math.max(remaining, 0))}
            </p>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Item Pesanan</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Qty Pesan</TableHead>
                  <TableHead>Qty Terima</TableHead>
                  <TableHead>Harga Satuan</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{ITEM_TYPE_LABEL[item.itemType]}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="font-mono-num">
                      {item.qtyOrdered} {item.unit}
                    </TableCell>
                    <TableCell className="font-mono-num">
                      {item.qtyReceived ? `${item.qtyReceived} ${item.unit}` : "-"}
                    </TableCell>
                    <TableCell className="font-mono-num">
                      {formatIDR(Number(item.unitPrice))}
                    </TableCell>
                    <TableCell className="text-right font-mono-num">
                      {formatIDR(Number(item.qtyOrdered) * Number(item.unitPrice))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat Pembayaran</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-0">
            {payments.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted">Belum ada pembayaran.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Metode</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead className="text-right">Nominal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.paymentDate)}</TableCell>
                      <TableCell>{METHOD_LABEL[p.method]}</TableCell>
                      <TableCell className="text-muted">{p.notes || "-"}</TableCell>
                      <TableCell className="text-right font-mono-num">
                        {formatIDR(Number(p.amount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {po.notes && (
          <Card className="p-5">
            <p className="text-sm font-medium text-ink">Catatan</p>
            <p className="mt-1 text-sm text-muted">{po.notes}</p>
          </Card>
        )}
      </main>
    </>
  );
}
