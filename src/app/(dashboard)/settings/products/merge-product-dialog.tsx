"use client";

import { useState, useTransition } from "react";
import { Merge } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { mergeProducts } from "./actions";

export function MergeProductDialog({
  sourceId,
  sourceName,
  candidates,
  label,
}: {
  sourceId: string;
  sourceName: string;
  candidates: { id: string; name: string }[];
  /** Text button label; omit for an icon button. */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={label ? "sm" : "icon"} variant={label ? "outline" : "ghost"} title="Gabungkan produk">
          <Merge className="size-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gabungkan Produk</DialogTitle>
          <DialogDescription>
            Semua penjualan, stok, dan retur &ldquo;{sourceName}&rdquo; dipindah ke produk yang
            dipilih. Nama lamanya disimpan sebagai alias. &ldquo;{sourceName}&rdquo; lalu
            dihapus dari daftar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="merge-target">Gabungkan ke produk</Label>
          <select
            id="merge-target"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
          >
            <option value="">Pilih produk tujuan…</option>
            {candidates
              .filter((c) => c.id !== sourceId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            type="button"
            disabled={!targetId || isPending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const result = await mergeProducts(sourceId, targetId);
                if (result?.error) setError(result.error);
                else {
                  toast.success("Produk digabung");
                  setOpen(false);
                }
              })
            }
          >
            {isPending ? "Menggabungkan..." : "Gabungkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
