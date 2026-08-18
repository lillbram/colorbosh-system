"use client";

import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Upload, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { importSalesCsv } from "../../actions";

type Option = { id: string; name: string };
type ProductOption = Option & { sku: string | null };

type FieldKey = "orderRef" | "entryDate" | "sku" | "qty" | "grossAmount";

const FIELD_LABEL: Record<FieldKey, string> = {
  orderRef: "No. Order",
  entryDate: "Tanggal",
  sku: "SKU Produk",
  qty: "Qty",
  grossAmount: "Total Bruto",
};

const AUTO_DETECT: Record<FieldKey, string[]> = {
  orderRef: ["order id", "order_id", "no order", "order number", "no. pesanan"],
  entryDate: ["order date", "tanggal", "date", "created time", "waktu pesanan dibuat"],
  sku: ["sku", "seller sku", "sku induk", "sku reference no."],
  qty: ["qty", "quantity", "jumlah"],
  grossAmount: ["total", "amount", "total harga produk", "order amount", "harga"],
};

function autoDetectColumn(headers: string[], field: FieldKey): string {
  const candidates = AUTO_DETECT[field];
  const match = headers.find((h) => candidates.includes(h.toLowerCase().trim()));
  return match ?? "";
}

function normalizeDate(value: string): string {
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return "";
}

export function CsvImportForm({
  channels,
  products,
  accounts,
}: {
  channels: Option[];
  products: ProductOption[];
  accounts: Option[];
}) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string>>({
    orderRef: "",
    entryDate: "",
    sku: "",
    qty: "",
    grossAmount: "",
  });
  const [channelId, setChannelId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const skuToProductId = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of products) {
      if (p.sku) map.set(p.sku.toLowerCase().trim(), p.id);
    }
    return map;
  }, [products]);

  const resolvedRows = useMemo(() => {
    if (!mapping.orderRef || !mapping.entryDate || !mapping.sku || !mapping.qty || !mapping.grossAmount) {
      return [];
    }
    return rawRows.map((row) => {
      const skuValue = String(row[mapping.sku] ?? "").toLowerCase().trim();
      const productId = skuToProductId.get(skuValue);
      const entryDate = normalizeDate(String(row[mapping.entryDate] ?? ""));
      const qty = Number(row[mapping.qty]);
      const grossAmount = Number(String(row[mapping.grossAmount] ?? "").replace(/[^\d.-]/g, ""));
      const orderRef = String(row[mapping.orderRef] ?? "").trim();

      const valid = Boolean(productId) && Boolean(entryDate) && qty > 0 && orderRef !== "";

      return { orderRef, entryDate, productId, qty, grossAmount, skuValue, valid };
    });
  }, [rawRows, mapping, skuToProductId]);

  const validCount = resolvedRows.filter((r) => r.valid).length;

  function handleFile(file: File) {
    setFileName(file.name);
    setError(null);

    const isExcel = /\.xlsx?$/i.test(file.name);

    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
        applyParsedRows(json);
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => applyParsedRows(results.data),
      });
    }
  }

  function applyParsedRows(rows: Record<string, string>[]) {
    if (rows.length === 0) {
      setError("File kosong atau format tidak dikenali");
      return;
    }
    const detectedHeaders = Object.keys(rows[0]);
    setHeaders(detectedHeaders);
    setRawRows(rows);
    setMapping({
      orderRef: autoDetectColumn(detectedHeaders, "orderRef"),
      entryDate: autoDetectColumn(detectedHeaders, "entryDate"),
      sku: autoDetectColumn(detectedHeaders, "sku"),
      qty: autoDetectColumn(detectedHeaders, "qty"),
      grossAmount: autoDetectColumn(detectedHeaders, "grossAmount"),
    });
  }

  function handleImport() {
    setError(null);
    const validRows = resolvedRows
      .filter((r) => r.valid)
      .map((r) => ({
        orderRef: r.orderRef,
        entryDate: r.entryDate,
        productId: r.productId!,
        qty: r.qty,
        grossAmount: r.grossAmount,
      }));

    if (validRows.length === 0) {
      setError("Tidak ada baris valid untuk diimpor. Cek pemetaan kolom dan SKU produk.");
      return;
    }

    const formData = new FormData();
    formData.set("channelId", channelId);
    formData.set("accountId", accountId);
    formData.set("rowsJson", JSON.stringify(validRows));

    startTransition(async () => {
      const result = await importSalesCsv(formData);
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        toast.success(
          `${result.insertedCount} baris berhasil diimpor${result.skipped ? `, ${result.skipped} dilewati (duplikat/tidak valid)` : ""}`
        );
        router.push("/sales");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Pilih Channel & Unggah File</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih channel" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Akun Tujuan</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih akun tujuan" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label
            htmlFor="csv-file"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-border py-10 text-center hover:bg-canvas/60"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <Upload className="size-8 text-muted" />
            <p className="text-sm font-medium text-ink">
              {fileName ?? "Tarik file ke sini atau klik untuk pilih"}
            </p>
            <p className="text-xs text-muted">Format CSV atau Excel (.xlsx) dari TikTok Shop / Shopee</p>
            <input
              id="csv-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        </CardContent>
      </Card>

      {headers.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>2. Pemetaan Kolom</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(FIELD_LABEL) as FieldKey[]).map((field) => (
                <div key={field} className="space-y-1.5">
                  <Label>{FIELD_LABEL[field]}</Label>
                  <Select
                    value={mapping[field]}
                    onValueChange={(v) => setMapping((prev) => ({ ...prev, [field]: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih kolom" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4" />
                3. Preview ({validCount} dari {resolvedRows.length} baris valid)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>No. Order</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resolvedRows.slice(0, 10).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {r.valid ? (
                          <CheckCircle2 className="size-4 text-success" />
                        ) : (
                          <span title="Tidak valid — cek SKU/tanggal/qty">
                            <AlertTriangle className="size-4 text-danger" />
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{r.orderRef || "-"}</TableCell>
                      <TableCell>{r.entryDate || "-"}</TableCell>
                      <TableCell>{r.skuValue || "-"}</TableCell>
                      <TableCell className="font-mono-num">{r.qty || "-"}</TableCell>
                      <TableCell className="text-right font-mono-num">
                        {r.grossAmount || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {resolvedRows.length > 10 && (
                <p className="p-3 text-xs text-muted">
                  Menampilkan 10 dari {resolvedRows.length} baris.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        {headers.length > 0 && <Badge variant="neutral">{validCount} baris siap diimpor</Badge>}
        <Button onClick={handleImport} disabled={isPending || !channelId || !accountId || validCount === 0}>
          {isPending ? "Mengimpor..." : "Impor Data"}
        </Button>
      </div>
    </div>
  );
}
