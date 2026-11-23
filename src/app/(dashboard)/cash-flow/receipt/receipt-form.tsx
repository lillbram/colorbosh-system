"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/forms/money-input";
import { formatDate, formatIDR } from "@/lib/format";
import { resizeImage } from "@/lib/resize-image";
import { scanReceiptImageFull, type ExtractedReceipt } from "@/lib/receipt-parser";
import { cn } from "@/lib/utils";
import {
  analyzeReceipt,
  saveReceiptTransaction,
  scanReceipt,
  type ReceiptAnalysis,
} from "./actions";

type Option = { id: string; name: string };
type Category = Option & { kind: "income" | "expense" };

type Draft = {
  path: string;
  extracted: ExtractedReceipt;
  analysis: ReceiptAnalysis;
  /** Bumps to remount uncontrolled inputs when a new receipt is read. */
  key: number;
};

export function ReceiptForm({
  accounts,
  categories,
  inbox,
  readsWithClaude,
}: {
  accounts: Option[];
  categories: Category[];
  inbox: { path: string; url: string } | null;
  readsWithClaude: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<"pick" | "reading" | "review">("pick");
  const [status, setStatus] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(inbox?.url ?? null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const startedInbox = useRef(false);

  async function readReceipt(file: File | null, existingPath?: string) {
    setError(null);
    setPhase("reading");
    setStatus(readsWithClaude ? "Membaca bukti transfer…" : "Mengunggah foto…");

    const form = new FormData();
    if (existingPath) form.set("existingPath", existingPath);
    else if (file) form.set("file", file);
    const scan = await scanReceipt(form);
    if (!scan.ok) {
      setError(scan.error);
      setPhase("pick");
      return;
    }

    let extracted = scan.extracted;
    let analysis = scan.analysis;
    if (!extracted || !analysis) {
      // No API key (or Claude couldn't read it): OCR in the browser instead.
      setStatus("Membaca di browser… bisa 10–20 detik pada pertama kali.");
      try {
        const source = file ?? (await (await fetch(inbox!.url)).blob());
        extracted = await scanReceiptImageFull(source);
        analysis = await analyzeReceipt(extracted);
      } catch {
        setError("Foto tidak terbaca. Coba foto yang lebih jelas.");
        setPhase("pick");
        return;
      }
    }

    if (!extracted.amount && !extracted.datetime) {
      setError("Data tidak terbaca dari foto ini. Coba foto yang lebih jelas.");
      setPhase("pick");
      return;
    }

    setDirection(extracted.direction);
    setAccountId(analysis.accountId ?? "");
    setCategoryId(analysis.categoryId ?? "");
    setDuplicateId(analysis.duplicate?.id ?? null);
    setDraft((d) => ({ path: scan.path, extracted, analysis, key: (d?.key ?? 0) + 1 }));
    setPhase("review");
  }

  // Share target: the shared image is already in storage, read it right away.
  useEffect(() => {
    if (inbox && !startedInbox.current) {
      startedInbox.current = true;
      readReceipt(null, inbox.path);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onPick(file: File | undefined) {
    if (!file) return;
    const small = await resizeImage(file);
    setPreviewUrl(URL.createObjectURL(small));
    await readReceipt(small);
  }

  const filteredCategories = categories.filter((c) => c.kind === (direction === "in" ? "income" : "expense"));
  const selectedCategory = categories.find((c) => c.id === categoryId);

  const defaultDescription = draft
    ? [
        draft.extracted.direction === "out" && draft.extracted.recipientName
          ? `Transfer ke ${draft.extracted.recipientName}`
          : draft.extracted.senderName
            ? `Transfer dari ${draft.extracted.senderName}`
            : "Transfer",
        draft.extracted.note,
      ]
        .filter(Boolean)
        .join(" - ")
    : "";

  return (
    <div className="mx-auto max-w-xl space-y-4">
      {error && (
        <Card className="border-danger/40 bg-danger/5 p-3 text-sm text-danger">{error}</Card>
      )}

      {phase !== "review" && (
        <Card className="space-y-3 p-4">
          {previewUrl && phase === "reading" && (
            // eslint-disable-next-line @next/next/no-img-element -- blob/signed URL preview
            <img src={previewUrl} alt="Bukti transfer" className="mx-auto max-h-64 rounded-lg border border-border" />
          )}
          {phase === "reading" ? (
            <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" />
              {status}
            </p>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-primary-500/50 bg-primary-50 p-8 text-center text-sm font-medium text-primary-700 hover:bg-primary-100">
              <Camera className="size-6" />
              Foto atau pilih bukti transfer
              <span className="text-xs font-normal text-muted">
                Screenshot BRImo atau foto struk. Data terisi otomatis.
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  onPick(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </Card>
      )}

      {phase === "review" && draft && (
        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await saveReceiptTransaction(formData);
              if (result.ok) {
                toast.success("Transaksi dicatat");
                router.push("/cash-flow");
              } else {
                setError(result.error);
                if (result.duplicateId) setDuplicateId(result.duplicateId);
              }
            });
          }}
          className="space-y-4"
        >
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- blob/signed URL preview
            <img src={previewUrl} alt="Bukti transfer" className="mx-auto max-h-48 rounded-lg border border-border" />
          )}

          {duplicateId && (
            <Card className="flex items-start gap-2 border-warning/40 bg-warning/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <div>
                <p className="font-medium text-ink">Bukti ini sudah tercatat</p>
                {draft.analysis.duplicate && (
                  <p className="text-muted">
                    {formatDate(draft.analysis.duplicate.txnDate)} · {formatIDR(draft.analysis.duplicate.amount)}
                  </p>
                )}
                <Link
                  href={`/cash-flow?ref=${encodeURIComponent(draft.extracted.bankRef ?? "")}`}
                  className="font-medium text-primary-600 hover:underline"
                >
                  Lihat transaksinya
                </Link>
              </div>
            </Card>
          )}

          {draft.extracted.confidence < 0.6 && (
            <p className="text-xs text-warning">Hasil baca kurang yakin — cek semua isian dengan teliti.</p>
          )}

          <Card className="space-y-4 p-4" key={draft.key}>
            <div className="grid grid-cols-2 gap-2">
              {(["in", "out"] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() => {
                    setDirection(dir);
                    setCategoryId("");
                  }}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium",
                    direction === dir
                      ? dir === "in"
                        ? "border-success bg-success/10 text-success"
                        : "border-danger bg-danger/10 text-danger"
                      : "border-border text-muted"
                  )}
                >
                  {dir === "in" ? "Uang Masuk" : "Uang Keluar"}
                </button>
              ))}
              <input type="hidden" name="direction" value={direction} />
            </div>

            <MoneyInput name="amount" label="Nominal" required defaultValue={draft.extracted.amount ?? undefined} />
            {direction === "out" && (
              <MoneyInput name="adminFee" label="Biaya admin" defaultValue={draft.extracted.adminFee || undefined} />
            )}

            <div className="space-y-1.5">
              <Label htmlFor="txnDate">
                Tanggal
                {draft.extracted.datetime?.includes("T") && (
                  <span className="ml-2 text-xs font-normal text-muted">
                    jam {draft.extracted.datetime.slice(11, 16)}
                  </span>
                )}
              </Label>
              <Input
                id="txnDate"
                name="txnDate"
                type="date"
                required
                defaultValue={draft.extracted.datetime?.slice(0, 10) ?? ""}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="accountId">Akun</Label>
              <select
                id="accountId"
                name="accountId"
                required
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
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

            <div className="space-y-1.5">
              <Label htmlFor="categoryId">
                Kategori
                {draft.analysis.reason && categoryId === draft.analysis.categoryId && (
                  <span className="ml-2 text-xs font-normal text-muted">saran: {draft.analysis.reason}</span>
                )}
              </Label>
              <select
                id="categoryId"
                name="categoryId"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
              >
                <option value="">Tanpa kategori</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCategory?.name === "Gaji" && (
              <div className="space-y-1.5">
                <Label htmlFor="periodMonth">Gaji untuk bulan</Label>
                <Input
                  id="periodMonth"
                  name="periodMonth"
                  type="month"
                  defaultValue={draft.analysis.periodMonth ?? ""}
                />
                <p className="text-xs text-muted">Saran: bulan tertua yang gajinya belum lunas. Ubah kalau perlu.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="description">Keterangan</Label>
              <Input id="description" name="description" required defaultValue={defaultDescription} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="counterparty">Nama lawan transaksi</Label>
                <Input
                  id="counterparty"
                  name="counterparty"
                  defaultValue={
                    (draft.extracted.direction === "out" ? draft.extracted.recipientName : draft.extracted.senderName) ?? ""
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bankRef">No. Ref</Label>
                <Input id="bankRef" name="bankRef" defaultValue={draft.extracted.bankRef ?? ""} />
              </div>
            </div>

            <input type="hidden" name="proofPath" value={draft.path} />
            <input type="hidden" name="status" value={draft.analysis.needsReview ? "draft" : "confirmed"} />
            {draft.analysis.needsReview && (
              <p className="text-xs text-warning">
                Akan disimpan sebagai &ldquo;Perlu dicek&rdquo; — kategori ini masih tebakan.
              </p>
            )}
          </Card>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(null);
                setPhase("pick");
                setPreviewUrl(null);
                setDuplicateId(null);
              }}
            >
              Ganti foto
            </Button>
            <Button type="submit" className="flex-1" disabled={isPending || !accountId || !!duplicateId}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
