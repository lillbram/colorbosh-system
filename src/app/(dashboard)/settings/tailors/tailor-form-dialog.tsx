"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createTailor, updateTailor } from "./actions";

type Tailor = {
  id: string;
  name: string;
  phone: string | null;
  defaultTermin1Pct: number | null;
  defaultLeadTimeDays: number | null;
  notes: string | null;
};

export function TailorFormDialog({ tailor }: { tailor?: Tailor }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(tailor);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="icon" variant="ghost">
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button variant="accent" size="sm">
            <Plus className="size-4" />
            Tambah Penjahit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah Penjahit" : "Penjahit Baru"}</DialogTitle>
        </DialogHeader>

        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = isEdit
                ? await updateTailor(tailor!.id, formData)
                : await createTailor(formData);
              if (result?.error) {
                setError(result.error);
              } else {
                toast.success(isEdit ? "Penjahit diperbarui" : "Penjahit ditambahkan");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Penjahit</Label>
            <Input id="name" name="name" defaultValue={tailor?.name} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telepon</Label>
            <Input id="phone" name="phone" defaultValue={tailor?.phone ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="defaultTermin1Pct">Termin 1 Default (%)</Label>
              <Input
                id="defaultTermin1Pct"
                name="defaultTermin1Pct"
                type="number"
                defaultValue={tailor?.defaultTermin1Pct ?? 50}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultLeadTimeDays">Lead Time (hari)</Label>
              <Input
                id="defaultLeadTimeDays"
                name="defaultLeadTimeDays"
                type="number"
                defaultValue={tailor?.defaultLeadTimeDays ?? 7}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea id="notes" name="notes" defaultValue={tailor?.notes ?? ""} />
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
