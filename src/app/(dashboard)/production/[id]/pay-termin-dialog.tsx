"use client";

import { useState, useTransition } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { formatIDR } from "@/lib/format";
import { payTailorTermin } from "../actions";

type AccountOpt = { id: string; name: string };

const METHOD_LABEL: Record<string, string> = {
  transfer: "Transfer",
  cash: "Tunai",
  cod: "COD",
  other: "Lainnya",
};

export function PayTerminDialog({
  paymentId,
  batchId,
  terminNo,
  amount,
  accounts,
}: {
  paymentId: string;
  batchId: string;
  terminNo: number;
  amount: number;
  accounts: AccountOpt[];
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
          <Wallet className="size-4" />
          Bayar Termin {terminNo}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bayar Termin {terminNo}</DialogTitle>
        </DialogHeader>

        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await payTailorTermin(paymentId, batchId, formData);
              if (result?.error) {
                setError(result.error);
              } else {
                toast.success("Pembayaran termin dicatat");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <p className="text-sm text-muted">
            Nominal: <span className="font-mono-num font-semibold text-ink">{formatIDR(amount)}</span>
          </p>

          <DateInput name="paidDate" label="Tanggal Bayar" defaultValue={new Date().toISOString().slice(0, 10)} />

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
