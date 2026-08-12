import { Truck } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
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
import { SupplierFormDialog } from "./supplier-form-dialog";
import { deleteSupplier } from "./actions";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const data = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.isDeleted, false))
    .orderBy(suppliers.name);

  return (
    <>
      <Header title="Supplier" subtitle="Kelola daftar pemasok kain, hiasan, dan plastik packing." />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex justify-end">
          <SupplierFormDialog />
        </div>

        <Card>
          {data.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Truck}
                title="Belum ada supplier"
                description="Tambahkan supplier pertama untuk mulai mencatat pemesanan kain."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Catatan</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.phone || "-"}</TableCell>
                    <TableCell>{s.whatsapp || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate text-muted">
                      {s.notes || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <SupplierFormDialog supplier={s} />
                        <ConfirmDeleteButton
                          itemName={`supplier "${s.name}"`}
                          onConfirm={deleteSupplier.bind(null, s.id)}
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
