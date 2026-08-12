import { Tag } from "lucide-react";
import { db } from "@/db";
import { categories } from "@/db/schema";
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
import { CategoryFormDialog } from "./category-form-dialog";
import { deleteCategory } from "./actions";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const data = await db.select().from(categories).orderBy(categories.name);

  return (
    <>
      <Header title="Kategori" subtitle="Kelola kategori uang masuk dan uang keluar." />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex justify-end">
          <CategoryFormDialog />
        </div>

        <Card>
          {data.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Tag}
                title="Belum ada kategori"
                description="Tambahkan kategori untuk mengelompokkan transaksi kas."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant={c.kind === "income" ? "success" : "warning"}>
                        {c.kind === "income" ? "Uang Masuk" : "Uang Keluar"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        {!c.isSystem && (
                          <ConfirmDeleteButton
                            itemName={`kategori "${c.name}"`}
                            onConfirm={deleteCategory.bind(null, c.id)}
                          />
                        )}
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
