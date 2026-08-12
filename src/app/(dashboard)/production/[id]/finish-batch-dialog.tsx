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

export function FinishBatchDialog({ batchId, targetQty }: { batchId: string; targetQty: number }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
            <Label htmlFor="actualQty">Qty Aktual (pcs)</Label>
            <Input id="actualQty" name="actualQty" type="number" defaultValue={targetQty} required />
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
