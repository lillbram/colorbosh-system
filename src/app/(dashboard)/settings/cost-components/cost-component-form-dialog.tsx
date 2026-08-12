"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createCostComponent, updateCostComponent } from "./actions";

type CostComponent = {
  id: string;
  name: string;
  category: "fabric" | "accessory" | "packaging" | "labor" | "other";
  unit: string;
  unitCost: string;
  notes: string | null;
  isActive: boolean | null;
};

const CATEGORY_LABEL: Record<CostComponent["category"], string> = {
  fabric: "Kain",
  accessory: "Hiasan",
  packaging: "Plastik Packing",
  labor: "Ongkos Jahit",
  other: "Lainnya",
};

export function CostComponentFormDialog({ component }: { component?: CostComponent }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CostComponent["category"]>(component?.category ?? "fabric");
  const [isActive, setIsActive] = useState(component?.isActive ?? true);
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(component);

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
            Tambah Komponen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah Komponen Biaya" : "Komponen Biaya Baru"}</DialogTitle>
        </DialogHeader>

        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = isEdit
                ? await updateCostComponent(component!.id, formData)
                : await createCostComponent(formData);
              if (result?.error) {
                setError(result.error);
              } else {
                toast.success(isEdit ? "Komponen biaya diperbarui" : "Komponen biaya ditambahkan");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Komponen</Label>
            <Input
              id="name"
              name="name"
              defaultValue={component?.name}
              placeholder="mis. Kain Rajut Sage"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CostComponent["category"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="category" value={category} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="unit">Satuan</Label>
              <Input id="unit" name="unit" defaultValue={component?.unit ?? "pcs"} placeholder="meter, pcs, set" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unitCost">Biaya per Satuan (Rp)</Label>
              <Input
                id="unitCost"
                name="unitCost"
                type="number"
                defaultValue={component?.unitCost}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea id="notes" name="notes" defaultValue={component?.notes ?? ""} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
            <Label htmlFor="isActive-switch">Komponen Aktif</Label>
            <Switch id="isActive-switch" checked={isActive} onCheckedChange={setIsActive} />
            <input type="hidden" name="isActive" value={isActive ? "true" : "false"} />
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
