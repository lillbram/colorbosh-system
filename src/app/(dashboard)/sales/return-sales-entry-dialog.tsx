"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { returnSalesEntry } from "./actions";

export function ReturnSalesEntryDialog({
  entryId,
  size = "sm",
}: {
  entryId: string;
  size?: "sm" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size} variant="outline">
          <Undo2 className="size-4" />
          {size === "sm" && "Retur"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tandai Retur</DialogTitle>
          <DialogDescription>
            Untuk barang yang sudah sampai ke pembeli lalu dikembalikan — berbeda dari Batalkan.
            Tercatat di audit log dan tidak bisa diurungkan dari sini.
          </DialogDescription>
        </DialogHeader>

        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await returnSalesEntry(entryId, formData);
              if (result?.error) {
                toast.error(result.error);
                setError(result.error);
              } else {
                toast.success("Ditandai retur");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="note">Catatan Retur (opsional)</Label>
            <Textarea id="note" name="note" placeholder="Alasan retur, kondisi barang, dst." />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Tutup
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Ya, Tandai Retur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
