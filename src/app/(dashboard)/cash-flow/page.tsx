import Link from "next/link";
import { Landmark } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cashTransactions, accounts, categories } from "@/db/schema";
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
import { formatDate, formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ManualEntryDialog } from "./manual-entry-dialog";
import { deleteManualCashTransaction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const { account: accountFilter } = await searchParams;

  const [accountList, categoryList, allTxns] = await Promise.all([
    db.select().from(accounts).orderBy(accounts.name),
    db.select().from(categories).orderBy(categories.name),
    db
      .select({
        id: cashTransactions.id,
        txnDate: cashTransactions.txnDate,
        direction: cashTransactions.direction,
        amount: cashTransactions.amount,
        description: cashTransactions.description,
        relatedType: cashTransactions.relatedType,
        accountId: cashTransactions.accountId,
        categoryId: cashTransactions.categoryId,
        accountName: accounts.name,
        categoryName: categories.name,
      })
      .from(cashTransactions)
      .leftJoin(accounts, eq(cashTransactions.accountId, accounts.id))
      .leftJoin(categories, eq(cashTransactions.categoryId, categories.id))
      .where(eq(cashTransactions.isDeleted, false))
      .orderBy(desc(cashTransactions.txnDate)),
  ]);

  const balances = accountList.map((acc) => {
    const netMovement = allTxns
      .filter((t) => t.accountId === acc.id)
      .reduce((sum, t) => sum + (t.direction === "in" ? 1 : -1) * Number(t.amount), 0);
    return { ...acc, balance: Number(acc.openingBalance) + netMovement };
  });

  const rows = accountFilter
    ? allTxns.filter((t) => t.accountId === accountFilter)
    : allTxns;

  const totalSaldo = balances.reduce((sum, b) => sum + b.balance, 0);

  return (
    <>
      <Header title="Arus Kas" subtitle="Semua uang masuk dan keluar dari setiap akun." />

      <main className="flex-1 space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5">
            <p className="text-sm text-muted">Total Saldo</p>
            <p className="font-mono-num mt-1 text-xl font-bold text-ink">
              {formatIDR(totalSaldo)}
            </p>
          </Card>
          {balances.map((acc) => (
            <Card key={acc.id} className="p-5">
              <p className="text-sm text-muted">{acc.name}</p>
              <p className="font-mono-num mt-1 text-xl font-bold text-ink">
                {formatIDR(acc.balance)}
              </p>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-black/5 p-1">
            <Link
              href="/cash-flow"
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                !accountFilter ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              )}
            >
              Semua Akun
            </Link>
            {accountList.map((acc) => (
              <Link
                key={acc.id}
                href={`/cash-flow?account=${acc.id}`}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium",
                  accountFilter === acc.id
                    ? "bg-white text-ink shadow-sm"
                    : "text-muted hover:text-ink"
                )}
              >
                {acc.name}
              </Link>
            ))}
          </div>
          <ManualEntryDialog accounts={accountList} categories={categoryList} />
        </div>

        <Card>
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Landmark}
                title="Belum ada transaksi"
                description="Transaksi akan muncul di sini otomatis dari pembayaran, penjualan, atau pencairan dana."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDate(t.txnDate)}</TableCell>
                    <TableCell>{t.accountName ?? "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {t.description}
                        {t.relatedType && t.relatedType !== "manual" && (
                          <Badge variant="neutral">otomatis</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{t.categoryName ?? "-"}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono-num font-medium",
                        t.direction === "in" ? "text-success" : "text-danger"
                      )}
                    >
                      {t.direction === "in" ? "+" : "-"}
                      {formatIDR(Number(t.amount))}
                    </TableCell>
                    <TableCell>
                      {t.relatedType === "manual" && (
                        <div className="flex items-center justify-end gap-1">
                          <ManualEntryDialog
                            accounts={accountList}
                            categories={categoryList}
                            entry={{
                              id: t.id,
                              txnDate: t.txnDate,
                              accountId: t.accountId,
                              categoryId: t.categoryId,
                              direction: t.direction,
                              amount: Number(t.amount),
                              description: t.description,
                            }}
                          />
                          <ConfirmDeleteButton
                            itemName="transaksi ini"
                            onConfirm={deleteManualCashTransaction.bind(null, t.id)}
                          />
                        </div>
                      )}
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
