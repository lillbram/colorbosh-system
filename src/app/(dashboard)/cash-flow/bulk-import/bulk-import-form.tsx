"use client";

import { useMemo, useState, useTransition } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Download, Upload, FileText, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatIDR } from "@/lib/format";
import { bulkImportCashTransactions } from "../actions";

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: "income" | "expense" };

const TEMPLATE_HEADERS = ["Tanggal", "Arah", "Akun", "Kategori", "Keterangan", "Nominal"];

type ResolvedRow = {
  txnDate: string;
  direction: "in" | "out" | null;
  accountId: string | null;
  accountRaw: string;
  categoryId: string | null;
  categoryRaw: string;
  description: string;
  amount: number;
  valid: boolean;
  reason: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseTanggal(value: unknown): string {
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  }
  const str = String(value ?? "").trim();
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${pad2(Number(m))}-${pad2(Number(d))}`;
  }
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${pad2(Number(m))}-${pad2(Number(d))}`;
  }
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(parsed.getUTCDate())}`;
  }
  return "";
}

function parseArah(value: unknown): "in" | "out" | null {
  const str = String(value ?? "").trim().toLowerCase();
  if (str === "masuk" || str === "in") return "in";
  if (str === "keluar" || str === "out") return "out";
  return null;
}

function parseNominal(value: unknown): number {
  if (typeof value === "number") return value;
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function BulkImportForm({
  accounts,
  categories,
}: {
  accounts: Account[];
  categories: Category[];
}) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const accountByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of accounts) map.set(a.name.toLowerCase().trim(), a.id);
    return map;
  }, [accounts]);

  const categoryByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) map.set(c.name.toLowerCase().trim(), c.id);
    return map;
  }, [categories]);

  const resolvedRows: ResolvedRow[] = useMemo(() => {
    return rawRows.map((row) => {
      const txnDate = parseTanggal(row["Tanggal"]);
      const direction = parseArah(row["Arah"]);
      const accountRaw = String(row["Akun"] ?? "").trim();
      const accountId = accountByName.get(accountRaw.toLowerCase()) ?? null;
      const categoryRaw = String(row["Kategori"] ?? "").trim();
      const categoryId = categoryRaw ? (categoryByName.get(categoryRaw.toLowerCase()) ?? null) : null;
      const description = String(row["Keterangan"] ?? "").trim();
      const amount = parseNominal(row["Nominal"]);

      let reason = "";
      if (!txnDate) reason = "Tanggal tidak valid";
      else if (!direction) reason = 'Arah harus "Masuk" atau "Keluar"';
      else if (!accountRaw) reason = "Akun kosong";
      else if (!accountId) reason = "Nama akun tidak ditemukan";
      else if (categoryRaw && !categoryId) reason = "Nama kategori tidak ditemukan";
      else if (!description) reason = "Keterangan kosong";
      else if (!(amount > 0)) reason = "Nominal harus lebih dari 0";

      return {
        txnDate,
        direction,
        accountId,
        accountRaw,
        categoryId,
        categoryRaw,
        description,
        amount,
        valid: reason === "",
        reason,
      };
    });
  }, [rawRows, accountByName, categoryByName]);

  const validCount = resolvedRows.filter((r) => r.valid).length;

  function downloadTemplate() {
    const templateSheet = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      [
        "18/08/2026",
        "Keluar",
        accounts[0]?.name ?? "Rekening Operasional",
        categories.find((c) => c.kind === "expense")?.name ?? "Operasional",
        "Contoh: Bayar listrik toko",
        150000,
      ],
    ]);
    templateSheet["!cols"] = [
      { wch: 14 },
      { wch: 10 },
      { wch: 24 },
      { wch: 20 },
      { wch: 30 },
      { wch: 14 },
    ];

    const guideRows: (string | number)[][] = [
      ["Petunjuk Pengisian"],
      [""],
      ["1. Tanggal: format DD/MM/YYYY atau YYYY-MM-DD."],
      ['2. Arah: isi persis "Masuk" atau "Keluar".'],
      ["3. Akun: isi persis salah satu nama akun di daftar bawah (huruf besar/kecil bebas)."],
      ["4. Kategori: opsional, isi persis salah satu nama kategori di daftar bawah, atau kosongkan."],
      ["5. Keterangan: wajib diisi, bebas."],
      ["6. Nominal: angka saja, tanpa 'Rp' atau titik/koma."],
      [""],
      ["Daftar Akun"],
      ...accounts.map((a) => [a.name]),
      [""],
      ["Daftar Kategori Uang Masuk"],
      ...categories.filter((c) => c.kind === "income").map((c) => [c.name]),
      [""],
      ["Daftar Kategori Uang Keluar"],
      ...categories.filter((c) => c.kind === "expense").map((c) => [c.name]),
    ];
    const guideSheet = XLSX.utils.aoa_to_sheet(guideRows);
    guideSheet["!cols"] = [{ wch: 40 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, templateSheet, "Template");
    XLSX.utils.book_append_sheet(workbook, guideSheet, "Panduan");
    XLSX.writeFile(workbook, "template-arus-kas.xlsx");
  }

  function handleFile(file: File) {
    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = workbook.Sheets["Template"] ?? workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (json.length === 0) {
        setError("File kosong atau format tidak dikenali");
        setRawRows([]);
        return;
      }
      setRawRows(json);
    };
    reader.readAsArrayBuffer(file);
  }

  function handleImport() {
    setError(null);
    const validRows = resolvedRows
      .filter((r) => r.valid)
      .map((r) => ({
        txnDate: r.txnDate,
        direction: r.direction!,
        accountId: r.accountId!,
        categoryId: r.categoryId ?? "",
        description: r.description,
        amount: r.amount,
      }));

    if (validRows.length === 0) {
      setError("Tidak ada baris valid untuk diimpor. Cek format tanggal, akun, dan kategori.");
      return;
    }

    const formData = new FormData();
    formData.set("rowsJson", JSON.stringify(validRows));

    startTransition(async () => {
      const result = await bulkImportCashTransactions(formData);
      if (result?.error) {
        setError(result.error);
        toast.error(result.error);
      } else {
        toast.success(`${result.insertedCount} transaksi berhasil dicatat`);
        router.push("/cash-flow");
      }
    });
  }

  return (
    <div className="max-w-4xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Unduh Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            Template berisi kolom Tanggal, Arah, Akun, Kategori, Keterangan, dan Nominal — plus
            daftar nama akun & kategori yang berlaku saat ini di tab &ldquo;Panduan&rdquo;, supaya
            tidak salah ketik.
          </p>
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="size-4" />
            Download Template Excel
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Unggah Template yang Sudah Diisi</CardTitle>
        </CardHeader>
        <CardContent>
          <label
            htmlFor="cash-bulk-file"
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
            <p className="text-xs text-muted">File Excel (.xlsx) hasil isian template di atas</p>
            <input
              id="cash-bulk-file"
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        </CardContent>
      </Card>

      {rawRows.length > 0 && (
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
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Arah</TableHead>
                  <TableHead>Akun</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolvedRows.slice(0, 20).map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {r.valid ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : (
                        <span title={r.reason}>
                          <AlertTriangle className="size-4 text-danger" />
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{r.txnDate || "-"}</TableCell>
                    <TableCell>
                      {r.direction === "in" ? "Masuk" : r.direction === "out" ? "Keluar" : "-"}
                    </TableCell>
                    <TableCell>{r.accountRaw || "-"}</TableCell>
                    <TableCell>{r.categoryRaw || "-"}</TableCell>
                    <TableCell className="text-muted">{r.description || "-"}</TableCell>
                    <TableCell className="text-right font-mono-num">
                      {r.amount ? formatIDR(r.amount) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {resolvedRows.length > 20 && (
              <p className="p-3 text-xs text-muted">
                Menampilkan 20 dari {resolvedRows.length} baris.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        {rawRows.length > 0 && <Badge variant="neutral">{validCount} baris siap dicatat</Badge>}
        <Button onClick={handleImport} disabled={isPending || validCount === 0}>
          {isPending ? "Mencatat..." : "Catat Transaksi"}
        </Button>
      </div>
    </div>
  );
}
