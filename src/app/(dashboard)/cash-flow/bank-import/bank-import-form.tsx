"use client";

import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
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
import { suggestCategory } from "@/lib/cash-rules";
import { finalBalance, parseStatementRow, type StatementRow } from "@/lib/brimo-statement";
import { formatDate, formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { importBankStatement, type BankImportResult } from "./actions";

type Option = { id: string; name: string };
type Category = Option & { kind: "income" | "expense" };

type Line =
  | { n: number; ok: true; row: StatementRow; categoryId: string | null; categoryName: string | null; needsReview: boolean; counterparty: string }
  | { n: number; ok: false; error: string };

export function BankImportForm({ accounts, categories }: { accounts: Option[]; categories: Category[] }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [accountId, setAccountId] = useState(accounts.length === 1 ? accounts[0].id : "");
  const [result, setResult] = useState<BankImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const categoryIdByName = useMemo(() => new Map(categories.map((c) => [c.name, c.id])), [categories]);

  function handleFile(file: File) {
    setFileName(file.name);
    setResult(null);
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const today = new Date().toISOString().slice(0, 10);
        setLines(
          res.data.map((rec, i) => {
            const parsed = parseStatementRow(rec);
            if (!parsed.ok) return { n: i + 2, ok: false as const, error: parsed.error };
            const row = parsed.row;
            const rule = suggestCategory(
              { direction: row.direction, counterparty: row.description, note: row.note, description: row.description },
              today
            );
            return {
              n: i + 2,
              ok: true as const,
              row,
              categoryId: rule.categoryName ? (categoryIdByName.get(rule.categoryName) ?? null) : null,
              categoryName: rule.categoryName,
              needsReview: rule.needsReview,
              counterparty: row.description.slice(0, 120),
            };
          })
        );
      },
    });
  }

  const good = lines.filter((l): l is Extract<Line, { ok: true }> => l.ok);
  const bad = lines.length - good.length;
  const statementBalance = finalBalance(good.map((l) => l.row));

  function submit() {
    startTransition(async () => {
      const res = await importBankStatement({
        accountId,
        statementBalance,
        rows: good.map((l) => ({
          key: l.row.key,
          txnDate: l.row.txnDate,
          direction: l.row.direction,
          amount: l.row.amount,
          description: l.row.description,
          counterparty: l.counterparty,
          categoryId: l.categoryId,
          needsReview: l.needsReview,
        })),
      });
      setResult(res);
      if (!res.ok) toast.error(res.error);
      else toast.success(`${res.inserted} transaksi masuk`);
    });
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="account">Akun</Label>
          <select
            id="account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="h-10 w-full max-w-sm rounded-lg border border-border bg-white px-3 text-sm"
          >
            <option value="" disabled>
              Pilih akun…
            </option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted hover:bg-canvas">
          <Upload className="size-5" />
          {fileName ?? "Pilih file e-Statement BRImo (.csv)"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>
      </Card>

      {result?.ok && (
        <Card className="space-y-2 p-4 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-success">
            <CheckCircle2 className="size-4" /> Selesai: {result.inserted} baru, {result.duplicates} sudah ada,{" "}
            {result.attached} cocok dengan bukti yang sudah diunggah.
          </p>
          {result.statementBalance !== null && (
            <p className={cn(result.computedBalance === result.statementBalance ? "text-success" : "text-warning")}>
              Cek saldo: di aplikasi {formatIDR(result.computedBalance)} · di mutasi{" "}
              {formatIDR(result.statementBalance)}
              {result.computedBalance === result.statementBalance
                ? " — cocok."
                : ` — selisih ${formatIDR(Math.abs(result.computedBalance - result.statementBalance))}. Biasanya karena mutasi sebelum file ini belum diimpor atau ada transaksi manual yang tidak ada di bank.`}
            </p>
          )}
        </Card>
      )}

      {lines.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 text-success">
              <CheckCircle2 className="size-4" /> {good.length} baris terbaca
            </span>
            {bad > 0 && (
              <span className="inline-flex items-center gap-1 text-danger">
                <AlertTriangle className="size-4" /> {bad} baris tidak valid (dilewati)
              </span>
            )}
            {statementBalance !== null && (
              <span className="text-muted">Saldo akhir di file: {formatIDR(statementBalance)}</span>
            )}
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead>Kategori (saran)</TableHead>
                  <TableHead className="text-right">Nominal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.slice(0, 200).map((l) =>
                  l.ok ? (
                    <TableRow key={l.n}>
                      <TableCell>{formatDate(l.row.txnDate)}</TableCell>
                      <TableCell className="max-w-xs truncate">{l.row.description}</TableCell>
                      <TableCell>
                        {l.categoryName ? (
                          <span className="inline-flex items-center gap-1">
                            {l.categoryName}
                            {l.needsReview && <Badge variant="warning">Perlu dicek</Badge>}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono-num",
                          l.row.direction === "in" ? "text-success" : "text-danger"
                        )}
                      >
                        {l.row.direction === "in" ? "+" : "-"}
                        {formatIDR(l.row.amount)}
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={l.n} className="bg-danger/5">
                      <TableCell>Baris {l.n}</TableCell>
                      <TableCell colSpan={3} className="text-sm text-danger">
                        {l.error}
                      </TableCell>
                    </TableRow>
                  )
                )}
              </TableBody>
            </Table>
          </Card>
          {lines.length > 200 && <p className="text-xs text-muted">Menampilkan 200 baris pertama dari {lines.length}.</p>}

          <div className="flex justify-end">
            <Button disabled={good.length === 0 || !accountId || isPending} onClick={submit}>
              {isPending ? "Mengimpor..." : `Impor ${good.length} Transaksi`}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
