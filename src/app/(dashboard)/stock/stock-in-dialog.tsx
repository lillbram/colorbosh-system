"use client";

import { useState, useTransition } from "react";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/forms/date-input";
import { addStockIn } from "./actions";

export function StockInDialog({
  products,
  cashOptions,
  today,
}: {
  products: { id: string; name: string }[];
  cashOptions: { id: string; label: string }[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          <PackagePlus className="size-4" />
          Stok Masuk
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stok Masuk</DialogTitle>
        </DialogHeader>
        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await addStockIn(formData);
              if (result?.error) setError(result.error);
              else {
                toast.success("Stok masuk dicatat");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="productId">Produk</Label>
            <select
              id="productId"
              name="productId"
              required
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
              defaultValue=""
            >
              <option value="" disabled>
                Pilih produk…
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qty">Jumlah (pcs)</Label>
            <Input id="qty" name="qty" type="number" inputMode="numeric" min={1} required />
          </div>
          <DateInput name="movementDate" label="Tanggal terima" defaultValue={today} />
          <div className="space-y-1.5">
            <Label htmlFor="cashTransactionId">Terkait pembayaran penjahit (opsional)</Label>
            <select
              id="cashTransactionId"
              name="cashTransactionId"
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
              defaultValue=""
            >
              <option value="">Tidak ada</option>
              {cashOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note">Catatan (opsional)</Label>
            <Input id="note" name="note" placeholder="mis. Batch Sri Ratih minggu 3" />
          </div>
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
