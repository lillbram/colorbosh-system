import Link from "next/link";
import { AlertTriangle, Shirt } from "lucide-react";
import { and, desc, eq, gte, lte, or, ilike, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { productionBatches, tailors, type batchStatusEnum } from "@/db/schema";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductionFilters } from "./production-filters";

export const dynamic = "force-dynamic";

type Status = (typeof batchStatusEnum.enumValues)[number];

const TABS: { label: string; value: Status | "all" }[] = [
  { label: "Semua", value: "all" },
  { label: "Direncanakan", value: "planned" },
  { label: "Diproses", value: "in_progress" },
  { label: "Selesai", value: "finished" },
  { label: "Terkirim", value: "delivered" },
];

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; q?: string }>;
}) {
  const { status, from = "", to = "", q = "" } = await searchParams;
  const activeStatus = (status as Status | undefined) ?? "all";

  const conditions: SQL[] = [eq(productionBatches.isDeleted, false)];
  if (activeStatus !== "all") conditions.push(eq(productionBatches.status, activeStatus));
  if (from) conditions.push(gte(productionBatches.startDate, from));
  if (to) conditions.push(lte(productionBatches.startDate, to));
  if (q) {
    const searchCondition = or(
      ilike(productionBatches.batchCode, `%${q}%`),
      ilike(tailors.name, `%${q}%`)
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  const batches = await db
    .select({
      id: productionBatches.id,
      batchCode: productionBatches.batchCode,
      status: productionBatches.status,
      startDate: productionBatches.startDate,
      targetFinishDate: productionBatches.targetFinishDate,
      targetQty: productionBatches.targetQty,
      actualQty: productionBatches.actualQty,
      tailorName: tailors.name,
    })
    .from(productionBatches)
    .leftJoin(tailors, eq(productionBatches.tailorId, tailors.id))
    .where(and(...conditions))
    .orderBy(desc(productionBatches.startDate));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Header title="Batch Produksi" subtitle="Kelola batch produksi kardigan dan pembayaran termin penjahit." />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-black/5 p-1">
            {TABS.map((tab) => (
              <Link
                key={tab.value}
                href={
                  tab.value === "all"
                    ? "/production"
                    : `/production?status=${tab.value}`
                }
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  activeStatus === tab.value
                    ? "bg-white text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                )}
              >
                {tab.label}
              </Link>
            ))}
          </div>
          <Link href="/production/new">
            <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent-500 px-4 text-sm font-medium text-white hover:bg-accent-600">
              + Batch Baru
            </span>
          </Link>
        </div>

        <ProductionFilters initialQ={q} initialFrom={from} initialTo={to} />

        <Card>
          {batches.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Shirt}
                title="Belum ada batch produksi"
                description={
                  from || to || q
                    ? "Tidak ada batch yang cocok dengan pencarian/filter."
                    : "Buat batch produksi pertama untuk mulai menjahit kardigan."
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode Batch</TableHead>
                  <TableHead>Penjahit</TableHead>
                  <TableHead>Mulai</TableHead>
                  <TableHead>Target Selesai</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => {
                  const isLate =
                    (b.status === "planned" || b.status === "in_progress") &&
                    b.targetFinishDate < today;

                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <Link
                          href={`/production/${b.id}`}
                          className="font-medium text-primary-600 hover:underline"
                        >
                          {b.batchCode}
                        </Link>
                      </TableCell>
                      <TableCell>{b.tailorName ?? "-"}</TableCell>
                      <TableCell>{formatDate(b.startDate)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          {formatDate(b.targetFinishDate)}
                          {isLate && (
                            <span title="Perlu perhatian — melewati target selesai">
                              <AlertTriangle className="size-3.5 text-danger" />
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono-num">
                        {b.actualQty ?? "-"}/{b.targetQty} pcs
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={b.status ?? "planned"} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </main>
    </>
  );
}
