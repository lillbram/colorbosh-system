"use client";

import { useMemo, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatIDR } from "@/lib/format";
import { parseSettlementRows, type SettlementRow } from "@/lib/tiktok-settlement";
import { applyTikTokSettlement, type SettlementResult } from "../actions";

type Channel = { id: string; name: string; type: string };

export function SettlementImportForm({ channels }: { channels: Channel[] }) {
  const [channelId, setChannelId] = useState(
    channels.find((c) => c.type === "tiktok_live")?.id ?? channels[0]?.id ?? ""
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<SettlementResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalFee = useMemo(() => rows.reduce((s, r) => s + r.fee, 0), [rows]);

  async function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    setNote(null);
    // Cells are text in this workbook; reading rows as formatted strings keeps long order ids exact.
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array", raw: true });
    const name = wb.SheetNames.find((n) => n.trim().toLowerCase() === "detail pesanan");
    if (!name) {
      setRows([]);
      setNote('Sheet "Detail pesanan" tidak ditemukan di file ini.');
      return;
    }
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: false, defval: "" });
    const parsed = parseSettlementRows(grid);
    setRows(parsed);
    if (parsed.length === 0) setNote("Tidak ada baris pesanan yang terbaca. Pastikan ini laporan penyelesaian (income) TikTok.");
  }

  function submit() {
    startTransition(async () => {
      const res = await applyTikTokSettlement({
        channelId,
        rows: rows.map((r) => ({ orderRef: r.orderRef, subtotal: r.subtotal, fee: r.fee })),
      });
      setResult(res);
      if (!res.ok) toast.error(res.error);
      else toast.success(`${res.updated} pesanan diperbarui`);
    });
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="channel">Channel</Label>
          <select
            id="channel"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="h-10 w-full max-w-sm rounded-lg border border-border bg-white px-3 text-sm"
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted hover:bg-canvas">
          <Upload className="size-5" />
          {fileName ?? "Pilih file .xlsx laporan penyelesaian TikTok"}
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
        {note && <p className="text-sm text-danger">{note}</p>}
      </Card>

      {rows.length > 0 && (
        <Card className="space-y-3 p-4 text-sm">
          <p className="flex items-center gap-1.5 text-success">
            <CheckCircle2 className="size-4" /> {rows.length} pesanan terbaca · total fee {formatIDR(totalFee)}
          </p>
          <p className="text-muted">
            Fee tiap pesanan menggantikan estimasi fee di penjualan yang cocok (No. Order sama). Aman diulang —
            hasilnya tidak bertambah.
          </p>
          <Button disabled={!channelId || isPending} onClick={submit}>
            {isPending ? "Memproses..." : `Terapkan ke ${rows.length} pesanan`}
          </Button>
        </Card>
      )}

      {result?.ok && (
        <Card className="space-y-2 p-4 text-sm">
          <p className="font-semibold text-success">
            {result.updated} pesanan diperbarui · fee {formatIDR(result.totalFee)}
          </p>
          {result.unmatched.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-warning">
                <AlertTriangle className="size-4" /> {result.unmatched.length} pesanan tidak ada di Penjualan
              </p>
              <p className="mt-1 break-all font-mono-num text-xs text-muted">
                {result.unmatched.slice(0, 30).join(", ")}
                {result.unmatched.length > 30 && ` … +${result.unmatched.length - 30} lagi`}
              </p>
              <p className="mt-1 text-xs text-muted">
                Biasanya karena penjualan hari itu masih berupa Rekap Live. Impor pesanan per-order dulu, lalu ulangi.
              </p>
            </div>
          )}
          {result.mismatched.length > 0 && (
            <div>
              <p className="flex items-center gap-1.5 text-warning">
                <AlertTriangle className="size-4" /> {result.mismatched.length} pesanan bruto-nya beda dengan file
              </p>
              <ul className="mt-1 text-xs text-muted">
                {result.mismatched.slice(0, 10).map((m) => (
                  <li key={m.orderRef}>
                    {m.orderRef}: aplikasi {formatIDR(m.app)} · file {formatIDR(m.file)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
