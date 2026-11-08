"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, ScanLine, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/forms/date-input";
import { MoneyInput } from "@/components/forms/money-input";
import { scanReceiptImage } from "@/lib/receipt-parser";
import { createManualCashTransaction, editManualCashTransaction } from "./actions";

type Option = { id: string; name: string };

type ExistingEntry = {
  id: string;
  txnDate: string;
  accountId: string | null;
  categoryId: string | null;
  direction: "in" | "out";
  amount: number;
  description: string | null;
};

export function ManualEntryDialog({
  accounts,
  categories,
  entry,
}: {
  accounts: Option[];
  categories: (Option & { kind: "income" | "expense" })[];
  /** Pass an existing entry to render this as an edit dialog instead of a create dialog. */
  entry?: ExistingEntry;
}) {
  const isEdit = !!entry;
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<"in" | "out">(entry?.direction ?? "out");
  const [accountId, setAccountId] = useState(entry?.accountId ?? "");
  const [categoryId, setCategoryId] = useState(entry?.categoryId ?? "");
  const [isPending, startTransition] = useTransition();
  const [scanning, setScanning] = useState(false);
  const [prefill, setPrefill] = useState<{
    key: number;
    amount?: number;
    txnDate?: string;
    description?: string;
  }>({ key: 0 });

  async function handleReceipt(file: File | undefined) {
    if (!file) return;
    setScanning(true);
    setError(null);
    try {
      const r = await scanReceiptImage(file);
      if (!r.amount && !r.txnDate && !r.recipient) {
        setError("Struk tidak terbaca. Coba foto yang lebih jelas atau isi manual.");
        return;
      }
      const description = [r.recipient && `Transfer ke ${r.recipient}`, r.note]
        .filter(Boolean)
        .join(" - ");
      setDirection("out");
      setPrefill((p) => ({
        key: p.key + 1,
        amount: r.amount ?? undefined,
        txnDate: r.txnDate ?? undefined,
        description: description || undefined,
      }));
      toast.success("Struk terbaca, cek lagi datanya sebelum simpan");
    } catch {
      setError("Gagal membaca struk. Coba lagi atau isi manual.");
    } finally {
      setScanning(false);
    }
  }

  const filteredCategories = categories.filter(
    (c) => c.kind === (direction === "in" ? "income" : "expense")
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="icon" variant="ghost">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button variant="accent" size="sm">
            <Plus className="size-4" />
            Catat Transaksi
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah Transaksi Kas" : "Transaksi Kas Manual"}</DialogTitle>
        </DialogHeader>

        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = isEdit
                ? await editManualCashTransaction(entry.id, formData)
                : await createManualCashTransaction(formData);
              if (result?.error) {
                setError(result.error);
              } else {
                toast.success(isEdit ? "Transaksi diubah" : "Transaksi dicatat");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          {!isEdit && (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-primary-500/50 bg-primary-50 px-3 py-3 text-sm font-medium text-primary-700 hover:bg-primary-100">
              {scanning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ScanLine className="size-4" />
              )}
              {scanning ? "Membaca struk..." : "Upload Bukti Transfer (BRImo)"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={scanning}
                onChange={(e) => {
                  handleReceipt(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection("in")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                direction === "in"
                  ? "border-success bg-success/10 text-success"
                  : "border-border text-muted"
              }`}
            >
              Uang Masuk
            </button>
            <button
              type="button"
              onClick={() => setDirection("out")}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                direction === "out"
                  ? "border-danger bg-danger/10 text-danger"
                  : "border-border text-muted"
              }`}
            >
              Uang Keluar
            </button>
            <input type="hidden" name="direction" value={direction} />
          </div>

          <MoneyInput
            key={`amt-${prefill.key}`}
            name="amount"
            label="Nominal"
            required
            defaultValue={prefill.amount ?? entry?.amount}
          />
          <DateInput
            key={`date-${prefill.key}`}
            name="txnDate"
            label="Tanggal"
            defaultValue={
              prefill.txnDate ?? entry?.txnDate ?? new Date().toISOString().slice(0, 10)
            }
          />

          <div className="space-y-1.5">
            <Label>Akun</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih akun" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="accountId" value={accountId} />
          </div>

          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih kategori" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="categoryId" value={categoryId} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Keterangan</Label>
            <Input
              key={`desc-${prefill.key}`}
              id="description"
              name="description"
              required
              placeholder="mis. Bayar listrik toko"
              defaultValue={prefill.description ?? entry?.description ?? ""}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending || !accountId}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
