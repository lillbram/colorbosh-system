"use client";

import { useState, useTransition } from "react";
import { Wallet, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { addPoPayment } from "../actions";

type AccountOpt = { id: string; name: string };

const METHOD_LABEL: Record<string, string> = {
  transfer: "Transfer",
  cash: "Tunai",
  cod: "COD",
  other: "Lainnya",
};

export function PaymentDialog({
  poId,
  accounts,
  remaining,
}: {
  poId: string;
  accounts: AccountOpt[];
  remaining: number;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState("transfer");
  const [accountId, setAccountId] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Plus className="size-4" />
          Catat Pembayaran
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-4 text-primary-500" />
            Catat Pembayaran ke Supplier
          </DialogTitle>
        </DialogHeader>

        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await addPoPayment(poId, formData);
              if (result?.error) {
                setError(result.error);
              } else {
                toast.success("Pembayaran dicatat");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <p className="text-sm text-muted">
            Sisa tagihan: <span className="font-mono-num font-semibold text-ink">{remaining.toLocaleString("id-ID")}</span>
          </p>

          <MoneyInput name="amount" label="Nominal Bayar" required />
          <DateInput name="paymentDate" label="Tanggal Bayar" defaultValue={new Date().toISOString().slice(0, 10)} />

          <div className="space-y-1.5">
            <Label>Metode</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METHOD_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="method" value={method} />
          </div>

          <div className="space-y-1.5">
            <Label>Bayar dari Akun</Label>
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
            <Label htmlFor="notes">Catatan</Label>
            <Textarea id="notes" name="notes" />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending || !accountId}>
              {isPending ? "Menyimpan..." : "Simpan Pembayaran"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
