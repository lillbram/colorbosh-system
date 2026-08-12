import Link from "next/link";
import { Wallet } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channels, accounts } from "@/db/schema";
import { getChannelBalances } from "@/lib/disbursement";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate, formatIDR } from "@/lib/format";
import { ConfirmPayoutDialog } from "./confirm-payout-dialog";

export const dynamic = "force-dynamic";

export default async function DisbursementPage() {
  const [balances, channelList, accountList] = await Promise.all([
    getChannelBalances(),
    db.select({ id: channels.id, name: channels.name }).from(channels).orderBy(channels.name),
    db
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(eq(accounts.isActive, true)),
  ]);

  const outstanding = balances
    .filter((b) => b.outstanding > 0.5)
    .sort((a, b) => b.outstanding - a.outstanding);
  const settled = balances.filter((b) => b.outstanding <= 0.5 && b.totalSold > 0);

  return (
    <>
      <Header
        title="Pencairan Dana"
        subtitle="Saldo belum cair per channel — dihitung otomatis dari total penjualan dikurangi total yang sudah diterima."
      />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ConfirmPayoutDialog channels={channelList} accounts={accountList} />
        </div>

        {balances.every((b) => b.totalSold === 0) ? (
          <Card className="p-6">
            <EmptyState
              icon={Wallet}
              title="Belum ada penjualan"
              description="Saldo belum cair muncul di sini otomatis setelah ada penjualan tercatat per channel."
            />
          </Card>
        ) : (
          <>
            <div>
              <p className="mb-2 px-1 text-sm font-semibold text-ink">
                Belum Cair ({outstanding.length})
              </p>
              {outstanding.length === 0 ? (
                <Card className="p-6">
                  <EmptyState
                    icon={Wallet}
                    title="Semua channel lunas"
                    description="Tidak ada saldo yang masih belum cair saat ini."
                  />
                </Card>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {outstanding.map((b) => (
                    <Link key={b.channelId} href={`/disbursement/${b.channelId}`}>
                      <Card className="p-4 transition-shadow hover:shadow-md">
                        <p className="text-sm font-semibold text-ink">{b.channelName}</p>
                        <p className="font-mono-num mt-2 text-xl font-bold text-warning">
                          {formatIDR(b.outstanding)}
                        </p>
                        <p className="mt-1 text-xs text-muted">Belum cair</p>
                        <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2">
                          <span className="text-xs text-muted">Dana Diterima</span>
                          <span className="font-mono-num text-sm font-semibold text-success">
                            {formatIDR(b.totalReceived)}
                          </span>
                        </div>
                        {b.oldestUnpaidDate && (
                          <p className="mt-2 text-xs text-muted">
                            Tertua sejak {formatDate(b.oldestUnpaidDate)}
                            {b.oldestUnpaidDays !== null && b.oldestUnpaidDays > 0
                              ? ` (${b.oldestUnpaidDays} hari)`
                              : ""}
                          </p>
                        )}
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {settled.length > 0 && (
              <div>
                <p className="mb-2 px-1 text-sm font-semibold text-ink">Lunas</p>
                <div className="flex flex-wrap gap-2">
                  {settled.map((b) => (
                    <Link key={b.channelId} href={`/disbursement/${b.channelId}`}>
                      <Badge variant="success">{b.channelName}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
