import Link from "next/link";
import { Boxes, ClipboardCheck } from "lucide-react";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { cashTransactions, categories } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
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
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { getCurrentRole } from "@/lib/auth";
import { formatDate, formatIDR } from "@/lib/format";
import { todayJakarta } from "@/lib/period";
import { getLowStockThreshold, getStockLevels } from "@/lib/stock";
import { StockInDialog } from "./stock-in-dialog";
import { OpeningStockDialog } from "./opening-stock-dialog";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const today = todayJakarta();
  const [levels, threshold, role, tailorTxns] = await Promise.all([
    getStockLevels(),
    getLowStockThreshold(),
    getCurrentRole(),
    db
      .select({
        id: cashTransactions.id,
        txnDate: cashTransactions.txnDate,
        amount: cashTransactions.amount,
        description: cashTransactions.description,
      })
      .from(cashTransactions)
      .innerJoin(categories, eq(cashTransactions.categoryId, categories.id))
      .where(
        and(
          eq(cashTransactions.isDeleted, false),
          eq(cashTransactions.direction, "out"),
          inArray(categories.name, ["Pembayaran Penjahit", "Bahan"])
        )
      )
      .orderBy(desc(cashTransactions.txnDate))
      .limit(30),
  ]);
  const isOwner = role === "owner";
  const totalValue = levels.reduce((sum, l) => sum + Math.max(0, l.qty) * l.hppTarget, 0);
  const totalQty = levels.reduce((sum, l) => sum + l.qty, 0);

  return (
    <>
      <Header title="Stok" subtitle="Stok barang jadi per produk." />

      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <p className="text-sm text-muted">Total Stok</p>
            <p className="font-mono-num mt-1 text-xl font-bold text-ink">{totalQty} pcs</p>
          </Card>
          {isOwner && (
            <Card className="p-4">
              <p className="flex items-center gap-1.5 text-sm text-muted">
                Nilai Stok
                <InfoTooltip>Jumlah stok × HPP tiap produk (diatur di Pengaturan &gt; Produk).</InfoTooltip>
              </p>
              <p className="font-mono-num mt-1 text-xl font-bold text-ink">{formatIDR(totalValue)}</p>
            </Card>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/stock/opname">
              <ClipboardCheck className="size-4" />
              Stock Opname
            </Link>
          </Button>
          <StockInDialog
            products={levels.map((l) => ({ id: l.productId, name: l.name }))}
            cashOptions={tailorTxns.map((t) => ({
              id: t.id,
              label: `${formatDate(t.txnDate)} · ${formatIDR(Number(t.amount))} · ${t.description ?? "-"}`,
            }))}
            today={today}
          />
        </div>

        <Card>
          {levels.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Boxes}
                title="Belum ada produk aktif"
                description="Tambahkan produk di Pengaturan > Produk dulu."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produk</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Stok</TableHead>
                  {isOwner && <TableHead className="text-right">Nilai</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {levels.map((l) => (
                  <TableRow key={l.productId}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell>{l.sku ?? "-"}</TableCell>
                    <TableCell className="text-right font-mono-num">{l.qty}</TableCell>
                    {isOwner && (
                      <TableCell className="text-right font-mono-num">
                        {formatIDR(Math.max(0, l.qty) * l.hppTarget)}
                      </TableCell>
                    )}
                    <TableCell>
                      {!l.hasOpening ? (
                        <Badge variant="neutral">Stok awal belum diatur</Badge>
                      ) : l.qty <= 0 ? (
                        <Badge variant="danger">Habis</Badge>
                      ) : l.qty <= threshold ? (
                        <Badge variant="warning">Menipis</Badge>
                      ) : (
                        <Badge variant="success">Aman</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!l.hasOpening && (
                        <OpeningStockDialog productId={l.productId} productName={l.name} today={today} />
                      )}
                    </TableCell>
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
