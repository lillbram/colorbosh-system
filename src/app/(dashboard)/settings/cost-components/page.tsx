import { Calculator } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { productionCostComponents } from "@/db/schema";
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
import { CostComponentFormDialog } from "./cost-component-form-dialog";
import { deleteCostComponent } from "./actions";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  fabric: "Kain",
  accessory: "Hiasan",
  packaging: "Plastik Packing",
  labor: "Ongkos Jahit",
  other: "Lainnya",
};

export default async function CostComponentsPage() {
  const data = await db
    .select()
    .from(productionCostComponents)
    .where(eq(productionCostComponents.isDeleted, false))
    .orderBy(productionCostComponents.category, productionCostComponents.name);

  return (
    <>
      <Header
        title="Komponen Biaya Produksi"
        subtitle="Daftar harga satuan kain, hiasan, packing, dan ongkos jahit untuk bantu estimasi biaya batch."
      />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex justify-end">
          <CostComponentFormDialog />
        </div>

        <Card>
          {data.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Calculator}
                title="Belum ada komponen biaya"
                description="Tambahkan harga satuan kain, hiasan, packing, dan ongkos jahit supaya estimasi biaya batch produksi lebih akurat."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Satuan</TableHead>
                  <TableHead>Biaya per Satuan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{CATEGORY_LABEL[c.category]}</TableCell>
                    <TableCell>{c.unit}</TableCell>
                    <TableCell className="font-mono-num">{formatIDR(Number(c.unitCost))}</TableCell>
                    <TableCell>
                      <Badge variant={c.isActive ? "success" : "neutral"}>
                        {c.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <CostComponentFormDialog component={c} />
                        <ConfirmDeleteButton
                          itemName={`komponen "${c.name}"`}
                          onConfirm={deleteCostComponent.bind(null, c.id)}
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
