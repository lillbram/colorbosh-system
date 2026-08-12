import { Scissors } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tailors } from "@/db/schema";
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
import { TailorFormDialog } from "./tailor-form-dialog";
import { deleteTailor } from "./actions";

export const dynamic = "force-dynamic";

export default async function TailorsPage() {
  const data = await db
    .select()
    .from(tailors)
    .where(eq(tailors.isDeleted, false))
    .orderBy(tailors.name);

  return (
    <>
      <Header title="Penjahit" subtitle="Kelola daftar penjahit dan aturan termin pembayaran." />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex justify-end">
          <TailorFormDialog />
        </div>

        <Card>
          {data.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Scissors}
                title="Belum ada penjahit"
                description="Tambahkan penjahit pertama untuk mulai membuat batch produksi."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead>Termin 1</TableHead>
                  <TableHead>Lead Time</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{t.phone || "-"}</TableCell>
                    <TableCell className="font-mono-num">{t.defaultTermin1Pct}%</TableCell>
                    <TableCell className="font-mono-num">
                      {t.defaultLeadTimeDays} hari
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <TailorFormDialog tailor={t} />
                        <ConfirmDeleteButton
                          itemName={`penjahit "${t.name}"`}
                          onConfirm={deleteTailor.bind(null, t.id)}
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
