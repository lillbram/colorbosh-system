import Link from "next/link";
import { AlertTriangle, PackageSearch } from "lucide-react";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { purchaseOrders, suppliers, type poStatusEnum } from "@/db/schema";
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
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import { formatDate, formatIDR } from "@/lib/format";

export const dynamic = "force-dynamic";

type Status = (typeof poStatusEnum.enumValues)[number];

const TABS: { label: string; value: Status | "all" }[] = [
  { label: "Semua", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Dipesan", value: "ordered" },
  { label: "Sebagian Diterima", value: "partially_received" },
  { label: "Diterima", value: "received" },
  { label: "Dibatalkan", value: "cancelled" },
];

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus = (status as Status | undefined) ?? "all";

  const whereClause =
    activeStatus === "all"
      ? eq(purchaseOrders.isDeleted, false)
      : and(eq(purchaseOrders.isDeleted, false), eq(purchaseOrders.status, activeStatus));

  const rows = await db
    .select({
      id: purchaseOrders.id,
      poNumber: purchaseOrders.poNumber,
      orderDate: purchaseOrders.orderDate,
      expectedDate: purchaseOrders.expectedDate,
      status: purchaseOrders.status,
      totalAmount: purchaseOrders.totalAmount,
      supplierName: suppliers.name,
    })
    .from(purchaseOrders)
    .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
    .where(whereClause)
    .orderBy(desc(purchaseOrders.orderDate));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Header
        title="Pemesanan Kain"
        subtitle="Kelola pengadaan kain roll, hiasan, dan plastik packing dari supplier."
      />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-black/5 p-1">
            {TABS.map((tab) => (
              <Link
                key={tab.value}
                href={tab.value === "all" ? "/procurement" : `/procurement?status=${tab.value}`}
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
          <Link href="/procurement/new">
            <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent-500 px-4 text-sm font-medium text-white hover:bg-accent-600">
              + Pemesanan Baru
            </span>
          </Link>
        </div>

        <Card>
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={PackageSearch}
                title="Belum ada pemesanan kain"
                description="Buat pemesanan kain pertama ke supplier untuk mulai produksi."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No. PO</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Tgl Pesan</TableHead>
                  <TableHead>Estimasi Tiba</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((po) => {
                  const isOverdue =
                    po.status === "ordered" &&
                    po.expectedDate &&
                    po.expectedDate < today;

                  return (
                    <TableRow key={po.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/procurement/${po.id}`} className="font-medium text-primary-600 hover:underline">
                          {po.poNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{po.supplierName ?? "-"}</TableCell>
                      <TableCell>{formatDate(po.orderDate)}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-1.5">
                          {po.expectedDate ? formatDate(po.expectedDate) : "-"}
                          {isOverdue && (
                            <span title="Perlu perhatian — melewati estimasi tiba">
                              <AlertTriangle className="size-3.5 text-danger" />
                            </span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono-num">
                        {formatIDR(Number(po.totalAmount))}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={po.status ?? "draft"} />
                        {isOverdue && (
                          <Badge variant="danger" className="ml-1.5">
                            Perlu Perhatian
                          </Badge>
                        )}
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
