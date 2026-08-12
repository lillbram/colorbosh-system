"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/forms/money-input";
import { editTerminAmount } from "../actions";

export function EditTerminAmountDialog({
  paymentId,
  batchId,
  terminNo,
  amount,
  hasUnpaidNextTermin,
}: {
  paymentId: string;
  batchId: string;
  terminNo: number;
  amount: number;
  hasUnpaidNextTermin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost">
          <Pencil className="size-4 text-muted" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ubah Nominal Termin {terminNo}</DialogTitle>
          {hasUnpaidNextTermin && (
            <DialogDescription>
              Termin berikutnya yang belum dibayar akan otomatis disesuaikan supaya totalnya tetap sama
              dengan total biaya produksi.
            </DialogDescription>
          )}
        </DialogHeader>

        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await editTerminAmount(paymentId, batchId, formData);
              if (result?.error) {
                setError(result.error);
              } else {
                toast.success("Nominal termin diperbarui");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <MoneyInput name="amount" label="Nominal Baru" defaultValue={amount} required />

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
