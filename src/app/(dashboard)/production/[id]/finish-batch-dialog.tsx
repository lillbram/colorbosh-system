"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
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
import { finishBatch } from "../actions";

type ProductLine = { id: string; productName: string; qty: number };

export function FinishBatchDialog({
  batchId,
  products,
}: {
  batchId: string;
  products: ProductLine[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualQtys, setActualQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries(products.map((p) => [p.id, String(p.qty)]))
  );
  const [isPending, startTransition] = useTransition();

  const total = products.reduce((sum, p) => sum + (Number(actualQtys[p.id]) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          <CheckCircle2 className="size-4" />
          Tandai Selesai
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Batch Produksi Selesai</DialogTitle>
        </DialogHeader>

        <form
          action={(formData) => {
            setError(null);
            formData.set(
              "productsJson",
              JSON.stringify(
                products.map((p) => ({
                  productionBatchProductId: p.id,
                  actualQty: Number(actualQtys[p.id]) || 0,
                }))
              )
            );
            startTransition(async () => {
              const result = await finishBatch(batchId, formData);
              if (result?.error) {
                setError(result.error);
              } else {
                toast.success("Batch ditandai selesai. Termin 2 dibuat otomatis.");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <DateInput
            name="actualFinishDate"
            label="Tanggal Selesai"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />

          <div className="space-y-1.5">
            <Label>Qty Aktual per Produk</Label>
            <div className="space-y-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-ink">{p.productName}</span>
                  <Input
                    type="number"
                    className="w-24"
                    value={actualQtys[p.id] ?? ""}
                    onChange={(e) =>
                      setActualQtys((prev) => ({ ...prev, [p.id]: e.target.value }))
                    }
                    required
                  />
                </div>
              ))}
            </div>
            <p className="text-right text-xs text-muted">
              Total: <span className="font-mono-num font-semibold text-ink">{total} pcs</span>
            </p>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending || total <= 0}>
              {isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
