"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { FileDown, ChevronDown, ChevronRight } from "lucide-react";
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
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { formatDate, formatIDR } from "@/lib/format";

type PnL = Awaited<ReturnType<typeof import("@/lib/reports").getPnLSummary>>;
type PerChannel = Awaited<ReturnType<typeof import("@/lib/reports").getPerChannelReport>>;
type PerProduct = Awaited<ReturnType<typeof import("@/lib/reports").getPerProductReport>>;
type CashFlow = Awaited<ReturnType<typeof import("@/lib/reports").getCashFlowReport>>;

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

function TotalPenjualanRow({ pnl }: { pnl: PnL }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <TableCell>
          <span className="inline-flex items-center gap-1.5">
            {open ? (
              <ChevronDown className="size-3.5 text-muted" />
            ) : (
              <ChevronRight className="size-3.5 text-muted" />
            )}
            Total Penjualan
            <span className="text-xs text-muted">
              ({pnl.penjualanPerChannel.length} channel — klik untuk rincian)
            </span>
          </span>
        </TableCell>
        <TableCell className="text-right font-mono-num">{formatIDR(pnl.totalPenjualan)}</TableCell>
      </TableRow>
      {open &&
        pnl.penjualanPerChannel.map((c) => (
          <TableRow key={c.name} className="bg-black/[0.02]">
            <TableCell className="pl-9 text-sm text-muted">
              {c.name}
              <span className="ml-1.5 text-xs">({c.pct.toFixed(0)}%)</span>
            </TableCell>
            <TableCell className="text-right font-mono-num text-sm text-muted">
              {formatIDR(c.gross)}
            </TableCell>
          </TableRow>
        ))}
    </>
  );
}

export function ReportTabs({
  pnl,
  perChannel,
  perProduct,
  cashFlow,
}: {
  pnl: PnL;
  perChannel: PerChannel;
  perProduct: PerProduct;
  cashFlow: CashFlow;
}) {
  return (
    <Tabs defaultValue="pnl">
      <TabsList>
        <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
        <TabsTrigger value="channel">Per Channel</TabsTrigger>
        <TabsTrigger value="product">Per Produk</TabsTrigger>
        <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
      </TabsList>

      <TabsContent value="pnl">
        <Card>
          <div className="flex items-center justify-between gap-2 p-4 pb-0">
            <InfoTooltip>
              Dihitung dari data periode filter di atas: Total Penjualan/Diskon/Fee Platform dari
              semua penjualan aktif (bukan dibatalkan/retur); Operasional dari transaksi kas
              manual (bukan otomatis). Laba Estimasi = Penjualan Bersih dikurangi Operasional —
              ini beda dari Profit Estimasi di Laporan Sederhana yang juga mengurangi HPP produk
              terjual. Klik baris &ldquo;Total Penjualan&rdquo; untuk lihat rincian per channel.
            </InfoTooltip>
            <ExportButton
              filename="laba-rugi"
              rows={[
                { Item: "Total Penjualan", Nominal: pnl.totalPenjualan },
                ...pnl.penjualanPerChannel.map((c) => ({
                  Item: `  - ${c.name}`,
                  Nominal: c.gross,
                })),
                { Item: "Diskon", Nominal: -pnl.totalDiskon },
                { Item: "Fee Platform Estimasi", Nominal: -pnl.totalFeePlatform },
                { Item: "Penjualan Bersih", Nominal: pnl.totalBersih },
                { Item: "Operasional", Nominal: -pnl.totalOperasional },
                { Item: "Laba Estimasi", Nominal: pnl.labaEstimasi },
              ]}
            />
          </div>
          <Table>
            <TableBody>
              <TotalPenjualanRow pnl={pnl} />
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
          <div className="flex items-center justify-between gap-2 p-4 pb-0">
            <InfoTooltip>
              Transaksi, Bruto, dan Bersih dijumlahkan per channel dari semua penjualan aktif
              (bukan dibatalkan/retur) dalam periode filter di atas. Bersih = Bruto dikurangi fee
              platform estimasi dan diskon.
            </InfoTooltip>
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
          <div className="flex items-center justify-between gap-2 p-4 pb-0">
            <InfoTooltip>
              Qty/Bruto/Bersih dari penjualan aktif dalam periode filter di atas. HPP diambil dari
              nilai yang diatur per produk di Pengaturan &gt; Produk (bukan periode filter —
              angkanya sama untuk periode manapun sampai diubah manual). Profit = Bersih periode
              ini dikurangi (HPP × Qty terjual periode ini).
            </InfoTooltip>
            <ExportButton
              filename="per-produk"
              rows={perProduct.map((p) => ({
                Produk: p.name,
                Qty: p.qty,
                "Total Bruto": p.gross,
                "Total Bersih": p.bersih,
                HPP: p.hpp,
                Profit: p.profit,
              }))}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produk</TableHead>
                <TableHead>Qty Terjual</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">Bersih</TableHead>
                <TableHead className="text-right">HPP</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {perProduct.map((p) => (
                <TableRow key={p.name}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="font-mono-num">{p.qty}</TableCell>
                  <TableCell className="text-right font-mono-num">{formatIDR(p.gross)}</TableCell>
                  <TableCell className="text-right font-mono-num">{formatIDR(p.bersih)}</TableCell>
                  <TableCell className="text-right font-mono-num">{formatIDR(p.hpp)}</TableCell>
                  <TableCell
                    className={`text-right font-mono-num ${p.profit < 0 ? "text-danger" : "text-success"}`}
                  >
                    {formatIDR(p.profit)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      <TabsContent value="cashflow">
        <Card>
          <div className="flex items-center justify-between gap-2 p-4 pb-0">
            <InfoTooltip>
              Semua transaksi di Arus Kas dalam periode filter di atas — baik yang otomatis dari
              Penjualan maupun yang dicatat manual.
            </InfoTooltip>
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
    </Tabs>
  );
}
