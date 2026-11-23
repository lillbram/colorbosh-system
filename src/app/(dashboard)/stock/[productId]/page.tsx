import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, stockMovements, users } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/format";
import { Boxes } from "lucide-react";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  opening: "Stok awal",
  production_in: "Stok masuk",
  sale_out: "Penjualan",
  return_in: "Retur masuk",
  adjustment: "Penyesuaian",
  opname: "Stock opname",
};

function label(type: string, refType: string | null) {
  if (refType === "sales_entry_cancel") return "Penjualan dibatalkan";
  return TYPE_LABEL[type] ?? type;
}

export default async function ProductStockLogPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(productId)) notFound();

  const [product] = await db
    .select({ name: products.name, sku: products.sku })
    .from(products)
    .where(eq(products.id, productId));
  if (!product) notFound();

  const rows = await db
    .select({
      id: stockMovements.id,
      date: stockMovements.movementDate,
      type: stockMovements.type,
      qty: stockMovements.qty,
      refType: stockMovements.refType,
      refId: stockMovements.refId,
      note: stockMovements.note,
      actor: users.name,
    })
    .from(stockMovements)
    .leftJoin(users, eq(users.id, stockMovements.createdBy))
    .where(eq(stockMovements.productId, productId))
    .orderBy(asc(stockMovements.movementDate), asc(stockMovements.createdAt));

  // Running balance never shows below 0 (older data may have gone negative).
  const balances = rows.reduce<number[]>((acc, r) => [...acc, Math.max(0, (acc[acc.length - 1] ?? 0) + r.qty)], []);
  const running = balances[balances.length - 1] ?? 0;
  const log = rows
    .map((r, i) => ({ ...r, before: i === 0 ? 0 : balances[i - 1], after: balances[i] }))
    .reverse();

  return (
    <>
      <Header title={product.name} subtitle={`Riwayat stok${product.sku ? ` · ${product.sku}` : ""}`} />
      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex items-center justify-between">
          <Link href="/stock" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
            <ArrowLeft className="size-4" /> Kembali ke Stok
          </Link>
          <p className="text-sm text-muted">
            Stok saat ini: <span className="font-mono-num text-lg font-bold text-ink">{running}</span>
          </p>
        </div>

        <Card>
          {log.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Boxes} title="Belum ada pergerakan stok" description="Atur stok awal dulu di halaman Stok." />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead className="text-right">Stok Awal</TableHead>
                      <TableHead className="text-right">Jumlah</TableHead>
                      <TableHead className="text-right">Stok Akhir</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead>Dicatat oleh</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {log.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDate(r.date)}</TableCell>
                        <TableCell>
                          <Badge variant={r.qty < 0 ? "warning" : "success"}>{label(r.type, r.refType)}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono-num">{r.before}</TableCell>
                        <TableCell className="text-right font-mono-num">
                          {r.qty > 0 ? `+${r.qty}` : r.qty}
                        </TableCell>
                        <TableCell className="text-right font-mono-num font-bold">{r.after}</TableCell>
                        <TableCell className="text-sm">
                          {r.refType?.startsWith("sales_entry") && r.refId ? (
                            <Link href={`/sales/${r.refId}`} className="text-primary-600 hover:underline">
                              Lihat penjualan
                            </Link>
                          ) : (
                            (r.note ?? "-")
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted">{r.actor ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="divide-y divide-border/70 md:hidden">
                {log.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{label(r.type, r.refType)}</p>
                      <p className="text-xs text-muted">
                        {formatDate(r.date)} · {r.actor ?? "-"}
                        {r.note ? ` · ${r.note}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-mono-num font-bold ${r.qty < 0 ? "text-warning" : "text-success"}`}>
                        {r.qty > 0 ? `+${r.qty}` : r.qty}
                      </p>
                      <p className="font-mono-num text-xs text-muted">{r.before} → {r.after}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </main>
    </>
  );
}
