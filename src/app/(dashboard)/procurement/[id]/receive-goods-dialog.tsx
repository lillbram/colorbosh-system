"use client";

import { useState, useTransition } from "react";
import { PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/forms/date-input";
import { receiveGoods } from "../actions";

type Item = {
  id: string;
  description: string;
  qtyOrdered: string;
  qtyReceived: string | null;
  unit: string | null;
};

export function ReceiveGoodsDialog({ poId, items }: { poId: string; items: Item[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, string>>(
    Object.fromEntries(items.map((i) => [i.id, i.qtyReceived ?? i.qtyOrdered]))
  );
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          <PackageCheck className="size-4" />
          Konfirmasi Kain Tiba
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Konfirmasi Penerimaan</DialogTitle>
        </DialogHeader>

        <form
          action={(formData) => {
            setError(null);
            const itemsJson = items.map((i) => ({
              id: i.id,
              qtyReceived: Number(qty[i.id] ?? 0),
            }));
            formData.set("itemsJson", JSON.stringify(itemsJson));

            startTransition(async () => {
              const result = await receiveGoods(poId, formData);
              if (result?.error) {
                setError(result.error);
              } else {
                toast.success("Penerimaan dicatat");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <DateInput
            name="actualArrivalDate"
            label="Tanggal Tiba"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/70 p-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{item.description}</p>
                  <p className="text-xs text-muted">
                    Dipesan: {item.qtyOrdered} {item.unit}
                  </p>
                </div>
                <Input
                  type="number"
                  className="h-9 w-24"
                  value={qty[item.id] ?? ""}
                  onChange={(e) => setQty((prev) => ({ ...prev, [item.id]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan Penerimaan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
