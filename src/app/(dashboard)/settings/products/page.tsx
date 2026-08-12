import { Layers } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
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
import { deleteProduct } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const data = await db
    .select()
    .from(products)
    .where(eq(products.isDeleted, false))
    .orderBy(products.name);

  return (
    <>
      <Header title="Produk" subtitle="Kelola daftar produk kardigan, SKU, dan target HPP." />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex justify-end">
          <ProductFormDialog />
        </div>

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
                    <TableCell>{p.sku || "-"}</TableCell>
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
