"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
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
import { DateInput } from "@/components/forms/date-input";
import { MoneyInput } from "@/components/forms/money-input";
import { addMarketplaceSnapshot } from "./actions";

export function SnapshotDialog({ channels, today }: { channels: { id: string; name: string }[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          <Plus className="size-4" />
          Catat Saldo Marketplace
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saldo Marketplace</DialogTitle>
          <DialogDescription>
            Salin angka dari Seller Center (halaman Saldo / Penghasilan). Dipakai untuk hitung Modal Berjalan.
          </DialogDescription>
        </DialogHeader>
        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await addMarketplaceSnapshot(formData);
              if (result?.error) setError(result.error);
              else {
                toast.success("Saldo marketplace dicatat");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="channelId">Channel</Label>
            <select
              id="channelId"
              name="channelId"
              required
              defaultValue={channels[0]?.id}
              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
            >
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <DateInput name="snapshotDate" label="Tanggal" defaultValue={today} />
          <MoneyInput name="awaitingDelivery" label="Menunggu paket diterima" />
          <MoneyInput name="settlementProcessing" label="Penyelesaian diproses" />
          <MoneyInput name="refundProcessing" label="Pengembalian diproses (tidak dihitung)" />
          <div className="space-y-1.5">
            <Label htmlFor="note">Catatan (opsional)</Label>
            <Input id="note" name="note" />
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
