"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setOpeningStock } from "./actions";

export function OpeningStockDialog({
  productId,
  productName,
  today,
}: {
  productId: string;
  productName: string;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Atur stok awal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stok Awal — {productName}</DialogTitle>
          <DialogDescription>
            Hitung stok fisik sekarang. Hanya bisa diatur sekali; koreksi berikutnya lewat Stock
            Opname.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="opening-qty">Jumlah stok fisik (pcs)</Label>
          <Input
            id="opening-qty"
            type="number"
            inputMode="numeric"
            min={0}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            type="button"
            disabled={qty === "" || isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await setOpeningStock(productId, Number(qty), today);
                if (result?.error) setError(result.error);
                else {
                  toast.success("Stok awal disimpan");
                  setOpen(false);
                }
              })
            }
          >
            {isPending ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
