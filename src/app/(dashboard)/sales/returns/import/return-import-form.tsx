"use client";

import { useMemo, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatIDR } from "@/lib/format";
import { parseTikTokReturnRow, type ParsedReturn } from "@/lib/tiktok-returns";
import { importTikTokReturns } from "../actions";

type Channel = { id: string; name: string; type: string };
type Product = { id: string; name: string; sku: string | null };
type Alias = { alias: string; productId: string };

const STATUS_LABEL = { completed: "Selesai", processing: "Diproses", rejected: "Ditolak" } as const;
const STATUS_VARIANT = { completed: "success", processing: "warning", rejected: "neutral" } as const;

type Row = { n: number; ok: true; data: ParsedReturn } | { n: number; ok: false; error: string };

export function ReturnImportForm({
  channels,
  products,
  aliases,
}: {
  channels: Channel[];
  products: Product[];
  aliases: Alias[];
}) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [picks, setPicks] = useState<Record<string, string>>({});
  const [channelId, setChannelId] = useState(
    channels.find((c) => c.type === "tiktok_live")?.id ?? channels[0]?.id ?? ""
  );
  const [restock, setRestock] = useState(true);
  const [isPending, startTransition] = useTransition();

  const lookup = useMemo(() => {
    const bySku = new Map(products.filter((p) => p.sku).map((p) => [p.sku!.toLowerCase(), p.id]));
    const byName = new Map<string, string>();
    for (const p of products) byName.set(p.name.toLowerCase(), p.id);
    for (const a of aliases) byName.set(a.alias.toLowerCase(), a.productId);
    return { bySku, byName };
  }, [products, aliases]);

  function resolve(d: ParsedReturn): string | null {
    if (picks[d.externalReturnId]) return picks[d.externalReturnId];
    if (d.sellerSku && lookup.bySku.has(d.sellerSku.toLowerCase())) return lookup.bySku.get(d.sellerSku.toLowerCase())!;
    if (d.productName && lookup.byName.has(d.productName.toLowerCase())) return lookup.byName.get(d.productName.toLowerCase())!;
    return null;
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    setPicks({});
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: false, defval: "" });
    setRows(
      records.map((rec, i) => {
        const r = parseTikTokReturnRow(rec);
        return r.ok ? { n: i + 2, ok: true as const, data: r.row } : { n: i + 2, ok: false as const, error: r.error };
      })
    );
  }

  const parsedOk = rows.filter((r): r is Extract<Row, { ok: true }> => r.ok);
  const importable = parsedOk.filter((r) => resolve(r.data));
  const unmatched = parsedOk.length - importable.length;
  const invalid = rows.length - parsedOk.length;

  function submit() {
    startTransition(async () => {
      const result = await importTikTokReturns({
        channelId,
        restock,
        rows: importable.map((r) => ({
          externalReturnId: r.data.externalReturnId,
          externalOrderId: r.data.externalOrderId,
          requestedAt: r.data.requestedAt,
          refundedAt: r.data.refundedAt,
          qty: r.data.qty,
          refundAmount: r.data.refundAmount,
          status: r.data.status,
          reason: r.data.reason,
          buyerNote: r.data.buyerNote,
          productName: r.data.productName,
          productId: resolve(r.data)!,
        })),
      });
      if (result?.error) toast.error(result.error);
      else {
        toast.success(`${result.inserted} retur baru, ${result.updated} diperbarui`);
        router.push("/sales?status=retur");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="channel">Channel</Label>
            <select
              id="channel"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
            <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="size-4" />
            Barang kembali ke stok (saat status Selesai)
          </label>
        </div>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted hover:bg-canvas">
          <Upload className="size-5" />
          {fileName ?? "Pilih file .xlsx dari Seller Center"}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      </Card>

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 className="size-4" /> {importable.length} siap diimpor
            </span>
            {unmatched > 0 && (
              <span className="inline-flex items-center gap-1 text-warning">
                <AlertTriangle className="size-4" /> {unmatched} produk belum cocok — pilih produknya
              </span>
            )}
            {invalid > 0 && (
              <span className="inline-flex items-center gap-1 text-danger">
                <AlertTriangle className="size-4" /> {invalid} baris tidak valid (dilewati)
              </span>
            )}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Baris</TableHead>
                  <TableHead>No. Retur</TableHead>
                  <TableHead>Diminta</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Refund</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 200).map((r) =>
                  r.ok ? (
                    <TableRow key={r.n}>
                      <TableCell className="font-mono-num">{r.n}</TableCell>
                      <TableCell className="font-mono-num text-xs">{r.data.externalReturnId}</TableCell>
                      <TableCell>{formatDate(r.data.requestedAt)}</TableCell>
                      <TableCell>
                        {resolve(r.data) ? (
                          <span className="text-sm">
                            {products.find((p) => p.id === resolve(r.data))?.name}
                          </span>
                        ) : (
                          <select
                            aria-label={`Produk untuk ${r.data.productName ?? r.data.externalReturnId}`}
                            value=""
                            onChange={(e) => setPicks((p) => ({ ...p, [r.data.externalReturnId]: e.target.value }))}
                            className="h-9 rounded-lg border border-warning bg-white px-2 text-sm"
                          >
                            <option value="">{r.data.productName ?? r.data.sellerSku ?? "Pilih produk"}…</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono-num">{r.data.qty}</TableCell>
                      <TableCell className="text-right font-mono-num">{formatIDR(r.data.refundAmount)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.data.status]}>{STATUS_LABEL[r.data.status]}</Badge>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={r.n} className="bg-danger/5">
                      <TableCell className="font-mono-num">{r.n}</TableCell>
                      <TableCell colSpan={6} className="text-sm text-danger">
                        {r.error}
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </Card>
          {rows.length > 200 && <p className="text-xs text-muted">Menampilkan 200 baris pertama dari {rows.length}.</p>}

          <div className="flex justify-end">
            <Button disabled={importable.length === 0 || !channelId || isPending} onClick={submit}>
              {isPending ? "Mengimpor..." : `Impor ${importable.length} Retur`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
