import { requireRole } from "@/lib/auth";
import { Layers } from "lucide-react";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, salesEntries } from "@/db/schema";
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
import { ConfirmDeleteButton } from "@/components/shared/confirm-delete-button";
import { formatIDR } from "@/lib/format";
import { ProductFormDialog } from "./product-form-dialog";
import { MergeProductDialog } from "./merge-product-dialog";
import { deleteProduct } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  await requireRole("owner");
  const data = await db
    .select()
    .from(products)
    .where(eq(products.isDeleted, false))
    .orderBy(products.name);

  // Soft-deleted products that active sales still point to need mapping to a live product.
  const unmapped = await db
    .select({ id: products.id, name: products.name, rows: count(salesEntries.id) })
    .from(products)
    .innerJoin(
      salesEntries,
      and(eq(salesEntries.productId, products.id), eq(salesEntries.isDeleted, false))
    )
    .where(eq(products.isDeleted, true))
    .groupBy(products.id);
  const candidates = data.map((p) => ({ id: p.id, name: p.name }));

  return (
    <>
      <Header title="Produk" subtitle="Kelola daftar produk kardigan, SKU, dan target HPP." />

      <main className="flex-1 space-y-4 p-4 md:p-6">
        <div className="flex justify-end">
          <ProductFormDialog />
        </div>

        {unmapped.length > 0 && (
          <Card className="border-warning/40 bg-warning/5 p-4">
            <p className="text-sm font-semibold text-ink">Perlu dipetakan</p>
            <p className="mt-0.5 text-xs text-muted">
              Produk ini sudah dihapus tapi masih dipakai di data penjualan. Gabungkan ke produk
              yang aktif supaya HPP dan stoknya benar.
            </p>
            <div className="mt-3 space-y-2">
              {unmapped.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {u.name} <span className="text-muted">· {u.rows} baris penjualan</span>
                  </span>
                  <MergeProductDialog
                    sourceId={u.id}
                    sourceName={u.name}
                    candidates={candidates}
                    label="Petakan"
                  />
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card>
          {data.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Layers}
                title="Belum ada produk"
                description="Tambahkan produk pertama untuk mulai mencatat produksi dan penjualan."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Harga Jual</TableHead>
                  <TableHead>Target HPP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>
                      {p.sku || <span className="text-danger">Belum ada SKU</span>}
                    </TableCell>
                    <TableCell>{p.category || "-"}</TableCell>
                    <TableCell className="font-mono-num">
                      {p.basePrice ? formatIDR(Number(p.basePrice)) : "-"}
                    </TableCell>
                    <TableCell className="font-mono-num">
                      {p.hppTarget ? formatIDR(Number(p.hppTarget)) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.isActive ? "success" : "neutral"}>
                        {p.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <ProductFormDialog product={p} />
                        <MergeProductDialog
                          sourceId={p.id}
                          sourceName={p.name}
                          candidates={candidates}
                        />
                        <ConfirmDeleteButton
                          itemName={`produk "${p.name}"`}
                          onConfirm={deleteProduct.bind(null, p.id)}
                        />
                      </div>
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
