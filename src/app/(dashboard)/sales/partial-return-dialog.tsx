"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/forms/money-input";
import { createPartialReturn } from "./returns/actions";

export function PartialReturnDialog({
  entryId,
  maxQty,
  unitPrice,
}: {
  entryId: string;
  maxQty: number;
  unitPrice: number;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Undo2 className="size-4" />
          Retur sebagian
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retur Sebagian</DialogTitle>
          <DialogDescription>
            Untuk sebagian barang dalam order ini (maksimal {maxQty} pcs). Dihitung sebagai Rugi
            Retur di laporan bulan retur dicatat.
          </DialogDescription>
        </DialogHeader>
        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await createPartialReturn(entryId, formData);
              if (result?.error) setError(result.error);
              else {
                toast.success("Retur dicatat");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="qty">Jumlah retur (pcs)</Label>
            <Input
              id="qty"
              name="qty"
              type="number"
              inputMode="numeric"
              min={1}
              max={maxQty}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              required
            />
          </div>
          <MoneyInput
            key={qty}
            name="refundAmount"
            label="Nominal refund"
            required
            defaultValue={Math.round(unitPrice * qty)}
          />
          <div className="space-y-1.5">
            <Label htmlFor="reason">Alasan (opsional)</Label>
            <Textarea id="reason" name="reason" placeholder="Alasan retur, kondisi barang, dst." />
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" name="restock" defaultChecked className="size-4" />
            Barang kembali ke stok
          </label>
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
