import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Wallet } from "lucide-react";
import { db } from "@/db";
import {
  productionBatches,
  productionBatchProducts,
  productionBatchCostItems,
  tailorPayments,
  tailors,
  products,
  accounts,
} from "@/db/schema";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
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
import { FinishBatchDialog } from "./finish-batch-dialog";
import { PayTerminDialog } from "./pay-termin-dialog";
import { EditTerminAmountDialog } from "./edit-termin-amount-dialog";

export const dynamic = "force-dynamic";

const FABRIC_SOURCE_LABEL: Record<string, string> = {
  from_po: "Dari Pemesanan Kain",
  tailor_own: "Dibeli Penjahit Sendiri",
};

export default async function ProductionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [batch] = await db
    .select({
      id: productionBatches.id,
      batchCode: productionBatches.batchCode,
      status: productionBatches.status,
      fabricSource: productionBatches.fabricSource,
      fabricUsedMeters: productionBatches.fabricUsedMeters,
      startDate: productionBatches.startDate,
      targetFinishDate: productionBatches.targetFinishDate,
      actualFinishDate: productionBatches.actualFinishDate,
      targetQty: productionBatches.targetQty,
      actualQty: productionBatches.actualQty,
      hppPerUnitCalc: productionBatches.hppPerUnitCalc,
      notes: productionBatches.notes,
      tailorName: tailors.name,
    })
    .from(productionBatches)
    .leftJoin(tailors, eq(productionBatches.tailorId, tailors.id))
    .where(eq(productionBatches.id, id));

  if (!batch) notFound();

  const [batchProducts, costItems, payments, accountList] = await Promise.all([
    db
      .select({ qty: productionBatchProducts.qty, productName: products.name })
      .from(productionBatchProducts)
      .leftJoin(products, eq(productionBatchProducts.productId, products.id))
      .where(eq(productionBatchProducts.batchId, id)),
    db
      .select()
      .from(productionBatchCostItems)
      .where(eq(productionBatchCostItems.batchId, id)),
    db.select().from(tailorPayments).where(eq(tailorPayments.batchId, id)).orderBy(tailorPayments.terminNo),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.isActive, true)),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const canFinish = batch.status === "planned" || batch.status === "in_progress";
  const totalCost = costItems.reduce((sum, c) => sum + Number(c.subtotal), 0);

  // Termin 2 only becomes a real row once the batch is marked finished — until
  // then, show a preview row so the full 2-termin structure is always visible.
  const termin1 = payments.find((p) => p.terminNo === 1);
  const hasTermin2 = payments.some((p) => p.terminNo === 2);
  const termin2Preview = !hasTermin2 && termin1
    ? { amount: String(Math.max(totalCost - Number(termin1.amount), 0)) }
    : null;

  return (
    <>
      <Header title={batch.batchCode} subtitle={batch.tailorName ?? "-"} />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={batch.status ?? "planned"} />
            <span className="text-sm text-muted">
              Mulai {formatDate(batch.startDate)} · Target {formatDate(batch.targetFinishDate)}
              {batch.actualFinishDate && ` · Selesai ${formatDate(batch.actualFinishDate)}`}
            </span>
          </div>
          {canFinish && <FinishBatchDialog batchId={batch.id} targetQty={batch.targetQty} />}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5">
            <p className="text-sm text-muted">Sumber Kain</p>
            <p className="mt-1 text-sm font-semibold text-ink">
              {FABRIC_SOURCE_LABEL[batch.fabricSource ?? "from_po"]}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted">Kain Terpakai</p>
            <p className="font-mono-num mt-1 text-xl font-bold text-ink">
              {batch.fabricUsedMeters ?? "-"} m
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted">Qty</p>
            <p className="font-mono-num mt-1 text-xl font-bold text-ink">
              {batch.actualQty ?? "-"}/{batch.targetQty} pcs
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted">HPP per Unit</p>
            <p className="font-mono-num mt-1 text-xl font-bold text-ink">
              {batch.hppPerUnitCalc ? formatIDR(Number(batch.hppPerUnitCalc)) : "-"}
            </p>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Produk</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batchProducts.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>{p.productName ?? "-"}</TableCell>
                    <TableCell className="text-right font-mono-num">{p.qty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rincian Biaya Produksi</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Komponen</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Harga Satuan</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {costItems.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      {c.label}
                      {c.isAdditional && (
                        <span className="ml-1.5 text-xs text-muted">(Biaya Tambahan)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono-num">{c.qty ?? "-"}</TableCell>
                    <TableCell className="text-right font-mono-num">
                      {c.unitCost ? formatIDR(Number(c.unitCost)) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono-num">
                      {formatIDR(Number(c.subtotal))}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-right text-sm font-semibold text-ink">
                    Total Biaya Produksi
                  </TableCell>
                  <TableCell className="text-right font-mono-num font-semibold text-ink">
                    {formatIDR(totalCost)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Termin Pembayaran Penjahit</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Termin</TableHead>
                  <TableHead>Nominal</TableHead>
                  <TableHead>Jatuh Tempo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => {
                  const isOverdue = p.status !== "paid" && p.dueDate && p.dueDate < today;
                  const effectiveStatus = isOverdue ? "overdue" : p.status ?? "pending";
                  const nextTermin = payments.find((o) => o.terminNo === p.terminNo + 1);
                  const hasUnpaidNextTermin = !!nextTermin && nextTermin.status !== "paid";
                  const earlierUnpaidTermin = payments.find(
                    (o) => o.terminNo < p.terminNo && o.status !== "paid"
                  );

                  return (
                    <TableRow key={p.id}>
                      <TableCell>Termin {p.terminNo}</TableCell>
                      <TableCell className="font-mono-num">{formatIDR(Number(p.amount))}</TableCell>
                      <TableCell>{p.dueDate ? formatDate(p.dueDate) : "-"}</TableCell>
                      <TableCell>
                        <StatusBadge status={effectiveStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        {p.status !== "paid" && (
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex justify-end gap-1">
                              <EditTerminAmountDialog
                                paymentId={p.id}
                                batchId={batch.id}
                                terminNo={p.terminNo}
                                amount={Number(p.amount)}
                                hasUnpaidNextTermin={hasUnpaidNextTermin}
                              />
                              {earlierUnpaidTermin ? (
                                <Button size="sm" variant="outline" disabled>
                                  <Wallet className="size-4" />
                                  Bayar Termin {p.terminNo}
                                </Button>
                              ) : (
                                <PayTerminDialog
                                  paymentId={p.id}
                                  batchId={batch.id}
                                  terminNo={p.terminNo}
                                  amount={Number(p.amount)}
                                  accounts={accountList}
                                />
                              )}
                            </div>
                            {earlierUnpaidTermin && (
                              <p className="text-xs text-muted">
                                Menunggu Termin {earlierUnpaidTermin.terminNo} dibayar
                              </p>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {termin2Preview && (
                  <TableRow className="text-muted">
                    <TableCell>Termin 2</TableCell>
                    <TableCell className="font-mono-num">
                      {formatIDR(Number(termin2Preview.amount))}
                    </TableCell>
                    <TableCell>-</TableCell>
                    <TableCell>
                      <StatusBadge status="not_created" />
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      Dibuat otomatis saat batch selesai
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {batch.notes && (
          <Card className="p-5">
            <p className="text-sm font-medium text-ink">Catatan</p>
            <p className="mt-1 text-sm text-muted">{batch.notes}</p>
          </Card>
        )}
      </main>
    </>
  );
}
