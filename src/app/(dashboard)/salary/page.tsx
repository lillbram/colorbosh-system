import { Paperclip } from "lucide-react";
import { db } from "@/db";
import { monthClosings } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { requireRole } from "@/lib/auth";
import { getSalaryOverview } from "@/lib/finance";
import { formatDate, formatIDR } from "@/lib/format";
import { monthLabel } from "@/lib/period";
import { cn } from "@/lib/utils";
import { CloseMonthButton, LockedMonthActions } from "./month-actions";

export const dynamic = "force-dynamic";

export default async function SalaryPage() {
  await requireRole("owner");
  const [overview, closings] = await Promise.all([getSalaryOverview(), db.select().from(monthClosings)]);
  const closingByMonth = new Map(closings.map((c) => [c.month, c]));
  const months = [...overview.months].reverse();
  const unassigned = overview.payments.filter((p) => !p.periodMonth);

  return (
    <>
      <Header title="Gaji" subtitle="Hak gaji admin = Laba Bersih bulanan, dibayar per bulan." />

      <main className="flex-1 space-y-4 p-4 md:p-6">
        <p className="text-sm text-muted">
          Persen gaji saat ini {overview.pct * 100}% dari Laba Bersih (ubah di Pengaturan → Umum).
          <InfoTooltip>
            Hak gaji = Laba Bersih bulan itu × persen gaji (tidak pernah negatif). Pembayaran dengan bulan yang jelas
            masuk ke bulan itu; yang tanpa bulan mengisi bulan tertua yang belum lunas.
          </InfoTooltip>
        </p>

        {months.length === 0 ? (
          <Card className="p-6 text-sm text-muted">Belum ada penjualan, jadi belum ada hak gaji.</Card>
        ) : (
          months.map((m) => {
            const closing = closingByMonth.get(m.month);
            const lunas = m.entitlement > 0 && m.remaining <= 0;
            const named = overview.payments.filter((p) => p.periodMonth === m.month);
            return (
              <Card key={m.month} className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-h3 text-ink">{monthLabel(m.month)}</h2>
                    {m.entitlement > 0 && <Badge variant={lunas ? "success" : "warning"}>{lunas ? "LUNAS" : "BELUM LUNAS"}</Badge>}
                    {closing && <Badge variant="neutral">Dikunci</Badge>}
                  </div>
                  {closing ? (
                    <LockedMonthActions
                      month={m.month}
                      snapshot={closing.snapshot as Parameters<typeof LockedMonthActions>[0]["snapshot"]}
                    />
                  ) : (
                    <CloseMonthButton month={m.month} />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-muted">Laba Bersih</p>
                    <p className={cn("font-mono-num font-semibold", m.labaBersih < 0 ? "text-danger" : "text-ink")}>
                      {formatIDR(m.labaBersih)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Hak Gaji</p>
                    <p className="font-mono-num font-semibold text-ink">{formatIDR(m.entitlement)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Sudah Dibayar</p>
                    <p className="font-mono-num font-semibold text-success">{formatIDR(m.paid)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Sisa</p>
                    <p className={cn("font-mono-num font-semibold", m.remaining > 0 ? "text-danger" : "text-ink")}>
                      {formatIDR(Math.max(0, m.remaining))}
                    </p>
                  </div>
                </div>

                {named.length > 0 && (
                  <div className="divide-y divide-border/70 rounded-lg bg-canvas text-sm">
                    {named.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span>
                          {formatDate(p.txnDate)} <span className="text-muted">{p.description}</span>
                        </span>
                        <span className="flex items-center gap-1 font-mono-num">
                          {formatIDR(p.amount)}
                          {p.hasProof && (
                            <Button size="icon" variant="ghost" asChild title="Lihat bukti">
                              <a href={`/cash-flow/proof/${p.id}`} target="_blank" rel="noreferrer">
                                <Paperclip className="size-4" />
                              </a>
                            </Button>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })
        )}

        {unassigned.length > 0 && (
          <Card className="space-y-2 p-4">
            <h2 className="text-h3 text-ink">Pembayaran tanpa bulan</h2>
            <p className="text-xs text-muted">
              Dialokasikan otomatis ke bulan tertua yang belum lunas. Edit transaksi di Arus Kas untuk menentukan
              bulannya.
            </p>
            <div className="divide-y divide-border/70 rounded-lg bg-canvas text-sm">
              {unassigned.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <span>
                    {formatDate(p.txnDate)} <span className="text-muted">{p.description}</span>
                  </span>
                  <span className="font-mono-num">{formatIDR(p.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </>
  );
}
