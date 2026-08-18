"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil } from "lucide-react";
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

          <MoneyInput name="amount" label="Nominal" required defaultValue={entry?.amount} />
          <DateInput
            name="txnDate"
            label="Tanggal"
            defaultValue={entry?.txnDate ?? new Date().toISOString().slice(0, 10)}
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
              id="description"
              name="description"
              required
              placeholder="mis. Bayar listrik toko"
              defaultValue={entry?.description ?? ""}
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
