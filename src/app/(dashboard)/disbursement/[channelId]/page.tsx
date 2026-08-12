import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { channels, salesEntries, products, payouts } from "@/db/schema";
import { getChannelBalances } from "@/lib/disbursement";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ConfirmCancelButton } from "@/components/shared/confirm-cancel-button";
import { Wallet } from "lucide-react";
import { formatDate, formatIDR } from "@/lib/format";
import { voidPayout } from "../actions";

export const dynamic = "force-dynamic";

export default async function DisbursementChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = await params;

  const [channel] = await db.select().from(channels).where(eq(channels.id, channelId));
  if (!channel) notFound();

  const [balances, payoutRows, entries] = await Promise.all([
    getChannelBalances(),
    db
      .select()
      .from(payouts)
      .where(eq(payouts.channelId, channelId))
      .orderBy(desc(payouts.actualDate), desc(payouts.createdAt)),
    db
      .select({
        id: salesEntries.id,
        entryDate: salesEntries.entryDate,
        productName: products.name,
        qty: salesEntries.qty,
        netExpected: salesEntries.netExpected,
      })
      .from(salesEntries)
      .leftJoin(products, eq(salesEntries.productId, products.id))
      .where(and(eq(salesEntries.channelId, channelId), eq(salesEntries.isDeleted, false)))
      .orderBy(salesEntries.entryDate),
  ]);

  const balance = balances.find((b) => b.channelId === channelId) ?? {
    totalSold: 0,
    totalReceived: 0,
    outstanding: 0,
    oldestUnpaidDate: null as string | null,
    oldestUnpaidDays: null as number | null,
  };

  // FIFO estimate, mirroring getChannelBalances(): walk entries oldest-first,
  // "consuming" totalReceived — whichever entry can't be fully absorbed (and
  // everything after it) counts as outstanding. Informational only, not a
  // real link to which order the platform actually paid.
  let covered = balance.totalReceived;
  const outstandingEntryIds = new Set<string>();
  for (const e of entries) {
    const amount = Number(e.netExpected);
    if (covered >= amount) {
      covered -= amount;
    } else {
      outstandingEntryIds.add(e.id);
    }
  }

  return (
    <>
      <Header
        title={channel.name}
        subtitle="Saldo belum cair dihitung otomatis dari total penjualan dikurangi total pencairan diterima."
      />

      <main className="flex-1 space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm text-muted">Total Terjual</p>
            <p className="font-mono-num mt-1 text-xl font-bold text-ink">
              {formatIDR(balance.totalSold)}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted">Total Diterima</p>
            <p className="font-mono-num mt-1 text-xl font-bold text-ink">
              {formatIDR(balance.totalReceived)}
            </p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-muted">
              {balance.outstanding < 0 ? "Lebih Bayar" : "Belum Cair"}
            </p>
            <p
              className={`font-mono-num mt-1 text-xl font-bold ${
                balance.outstanding > 0.5
                  ? "text-warning"
                  : balance.outstanding < -0.5
                    ? "text-danger"
                    : "text-success"
              }`}
            >
              {formatIDR(Math.abs(balance.outstanding))}
            </p>
            {balance.oldestUnpaidDate && (
              <p className="mt-1 text-xs text-muted">
                Tertua sejak {formatDate(balance.oldestUnpaidDate)}
                {balance.oldestUnpaidDays !== null && balance.oldestUnpaidDays > 0
                  ? ` (${balance.oldestUnpaidDays} hari)`
                  : ""}
              </p>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat Pencairan ({payoutRows.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-0">
            {payoutRows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Wallet}
                  title="Belum ada pencairan"
                  description="Klik 'Payout Diterima' di halaman Pencairan Dana untuk mencatat."
                />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jumlah</TableHead>
                    <TableHead>No. Ref</TableHead>
                    <TableHead>Catatan</TableHead>
                    <TableHead className="w-24">Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payoutRows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.actualDate)}</TableCell>
                      <TableCell className="font-mono-num">{formatIDR(Number(p.actualAmount))}</TableCell>
                      <TableCell>{p.bankRef ?? "-"}</TableCell>
                      <TableCell className="text-muted">{p.notes ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant={p.isDeleted ? "danger" : "success"}>
                          {p.isDeleted ? "Dibatalkan" : "Aktif"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {!p.isDeleted && (
                          <ConfirmCancelButton
                            itemName="pencairan ini"
                            size="icon"
                            onConfirm={voidPayout.bind(null, p.id)}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Penjualan Belum Cair (estimasi FIFO)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-0">
            {outstandingEntryIds.size === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Wallet}
                  title="Tidak ada yang belum cair"
                  description="Semua penjualan channel ini sudah tercakup oleh pencairan yang diterima."
                />
              </div>
            ) : (
              <>
                <p className="px-4 pt-4 text-xs text-muted">
                  Estimasi urutan tertua-dulu, bukan kepastian order mana yang sudah dibayar platform.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Produk</TableHead>
                      <TableHead>Qty</TableHead>
                      <TableHead className="text-right">Bersih</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries
                      .filter((e) => outstandingEntryIds.has(e.id))
                      .map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{formatDate(e.entryDate)}</TableCell>
                          <TableCell>{e.productName ?? "-"}</TableCell>
                          <TableCell className="font-mono-num">{e.qty}</TableCell>
                          <TableCell className="text-right font-mono-num">
                            {formatIDR(Number(e.netExpected))}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
