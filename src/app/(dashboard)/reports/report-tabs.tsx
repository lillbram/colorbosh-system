"use client";

import * as XLSX from "xlsx";
import { FileDown } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatIDR } from "@/lib/format";

type PnL = Awaited<ReturnType<typeof import("@/lib/reports").getPnLSummary>>;
type PerChannel = Awaited<ReturnType<typeof import("@/lib/reports").getPerChannelReport>>;
type PerProduct = Awaited<ReturnType<typeof import("@/lib/reports").getPerProductReport>>;
type CashFlow = Awaited<ReturnType<typeof import("@/lib/reports").getCashFlowReport>>;
type PerTailor = Awaited<ReturnType<typeof import("@/lib/reports").getPerTailorReport>>;
type Aging = Awaited<ReturnType<typeof import("@/lib/reports").getAgingPayoutReport>>;

function ExportButton({ filename, rows }: { filename: string; rows: Record<string, unknown>[] }) {
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={rows.length === 0}
      onClick={() => {
        const sheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, sheet, "Data");
        XLSX.writeFile(workbook, `${filename}.xlsx`);
      }}
    >
      <FileDown className="size-4" />
      Export Excel
    </Button>
  );
}

export function ReportTabs({
  pnl,
  perChannel,
  perProduct,
  cashFlow,
  perTailor,
  aging,
}: {
  pnl: PnL;
  perChannel: PerChannel;
  perProduct: PerProduct;
  cashFlow: CashFlow;
  perTailor: PerTailor;
  aging: Aging;
}) {
  return (
    <Tabs defaultValue="pnl">
      <TabsList>
        <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
        <TabsTrigger value="channel">Per Channel</TabsTrigger>
        <TabsTrigger value="product">Per Produk</TabsTrigger>
        <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
        <TabsTrigger value="tailor">Per Penjahit</TabsTrigger>
        <TabsTrigger value="aging">Aging Payout</TabsTrigger>
      </TabsList>

      <TabsContent value="pnl">
        <Card>
          <div className="flex justify-end p-4 pb-0">
            <ExportButton
              filename="laba-rugi"
              rows={[
                { Item: "Total Penjualan", Nominal: pnl.totalPenjualan },
                { Item: "Diskon", Nominal: -pnl.totalDiskon },
                { Item: "Fee Platform Estimasi", Nominal: -pnl.totalFeePlatform },
                { Item: "Penjualan Bersih", Nominal: pnl.totalBersih },
                { Item: "Bayar Supplier", Nominal: -pnl.totalBayarSupplier },
                { Item: "Bayar Penjahit", Nominal: -pnl.totalBayarPenjahit },
                { Item: "Operasional", Nominal: -pnl.totalOperasional },
                { Item: "Laba Estimasi", Nominal: pnl.labaEstimasi },
              ]}
            />
          </div>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Total Penjualan</TableCell>
                <TableCell className="text-right font-mono-num">{formatIDR(pnl.totalPenjualan)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted">Diskon</TableCell>
                <TableCell className="text-right font-mono-num text-danger">
                  -{formatIDR(pnl.totalDiskon)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted">Fee Platform Estimasi</TableCell>
                <TableCell className="text-right font-mono-num text-danger">
                  -{formatIDR(pnl.totalFeePlatform)}
                </TableCell>
              </TableRow>
              <TableRow className="border-t-2 border-border">
                <TableCell className="font-medium">Penjualan Bersih</TableCell>
                <TableCell className="text-right font-mono-num font-medium">
                  {formatIDR(pnl.totalBersih)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted">Bayar Supplier</TableCell>
                <TableCell className="text-right font-mono-num text-danger">
                  -{formatIDR(pnl.totalBayarSupplier)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted">Bayar Penjahit</TableCell>
                <TableCell className="text-right font-mono-num text-danger">
                  -{formatIDR(pnl.totalBayarPenjahit)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted">Operasional</TableCell>
                <TableCell className="text-right font-mono-num text-danger">
                  -{formatIDR(pnl.totalOperasional)}
                </TableCell>
              </TableRow>
              <TableRow className="border-t-2 border-border">
                <TableCell className="font-semibold">Laba Estimasi</TableCell>
                <TableCell
                  className={`text-right font-mono-num text-base font-bold ${pnl.labaEstimasi >= 0 ? "text-success" : "text-danger"}`}
                >
                  {formatIDR(pnl.labaEstimasi)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="channel">
        <Card>
          <div className="flex justify-end p-4 pb-0">
            <ExportButton
              filename="per-channel"
              rows={perChannel.map((c) => ({
                Channel: c.name,
                Transaksi: c.transaksi,
                "Total Bruto": c.gross,
                "Total Bersih": c.bersih,
              }))}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Transaksi</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Bersih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perChannel.map((c) => (
                <TableRow key={c.name}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell className="font-mono-num">{c.transaksi}</TableCell>
                  <TableCell className="text-right font-mono-num">{formatIDR(c.gross)}</TableCell>
                  <TableCell className="text-right font-mono-num">{formatIDR(c.bersih)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="product">
        <Card>
          <div className="flex justify-end p-4 pb-0">
            <ExportButton
              filename="per-produk"
              rows={perProduct.map((p) => ({
                Produk: p.name,
                Qty: p.qty,
                "Total Bruto": p.gross,
                "Total Bersih": p.bersih,
              }))}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Bersih</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perProduct.map((p) => (
                <TableRow key={p.name}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="font-mono-num">{p.qty}</TableCell>
                  <TableCell className="text-right font-mono-num">{formatIDR(p.gross)}</TableCell>
                  <TableCell className="text-right font-mono-num">{formatIDR(p.bersih)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="cashflow">
        <Card>
          <div className="flex justify-end p-4 pb-0">
            <ExportButton
              filename="cash-flow"
              rows={cashFlow.map((c) => ({
                Tanggal: c.tanggal,
                Arah: c.arah === "in" ? "Masuk" : "Keluar",
                Akun: c.akun,
                Kategori: c.kategori,
                Keterangan: c.keterangan,
                Nominal: c.nominal,
              }))}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Akun</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cashFlow.map((c, i) => (
                <TableRow key={i}>
                  <TableCell>{formatDate(c.tanggal)}</TableCell>
                  <TableCell>{c.akun}</TableCell>
                  <TableCell className="text-muted">{c.keterangan}</TableCell>
                  <TableCell
                    className={`text-right font-mono-num ${c.arah === "in" ? "text-success" : "text-danger"}`}
                  >
                    {c.arah === "in" ? "+" : "-"}
                    {formatIDR(c.nominal)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="tailor">
        <Card>
          <div className="flex justify-end p-4 pb-0">
            <ExportButton
              filename="per-penjahit"
              rows={perTailor.map((t) => ({
                Penjahit: t.name,
                "Jumlah Batch": t.batchCount,
                "Total Dibayar": t.totalDibayar,
                "Total Tertunda": t.totalTertunda,
              }))}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Penjahit</TableHead>
                <TableHead>Jumlah Batch</TableHead>
                <TableHead className="text-right">Dibayar</TableHead>
                <TableHead className="text-right">Tertunda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perTailor.map((t) => (
                <TableRow key={t.name}>
                  <TableCell>{t.name}</TableCell>
                  <TableCell className="font-mono-num">{t.batchCount}</TableCell>
                  <TableCell className="text-right font-mono-num">{formatIDR(t.totalDibayar)}</TableCell>
                  <TableCell className="text-right font-mono-num text-warning">
                    {formatIDR(t.totalTertunda)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="aging">
        <Card>
          <div className="flex justify-end p-4 pb-0">
            <ExportButton
              filename="aging-payout"
              rows={aging.map((a) => ({
                Channel: a.channelName,
                Periode: a.periode,
                "Belum Cair Sejak": a.expectedPayoutDate,
                "Hari Terlambat": a.daysOverdue,
                Status: a.bucket,
                Nominal: a.expectedAmount,
              }))}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Nominal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aging.map((a, i) => (
                <TableRow key={i}>
                  <TableCell>{a.channelName}</TableCell>
                  <TableCell className="text-muted">{a.periode}</TableCell>
                  <TableCell>
                    <span className={a.daysOverdue > 14 ? "text-danger" : a.daysOverdue > 0 ? "text-warning" : "text-muted"}>
                      {a.bucket}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono-num">
                    {formatIDR(a.expectedAmount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
