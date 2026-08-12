"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createProduct, updateProduct } from "./actions";

type Product = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  basePrice: string | null;
  hppTarget: string | null;
  isActive: boolean | null;
};

export function ProductFormDialog({ product }: { product?: Product }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(product);

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
            Tambah Produk
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah Produk" : "Produk Baru"}</DialogTitle>
        </DialogHeader>

        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = isEdit
                ? await updateProduct(product!.id, formData)
                : await createProduct(formData);
              if (result?.error) {
                setError(result.error);
              } else {
                toast.success(isEdit ? "Produk diperbarui" : "Produk ditambahkan");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Produk</Label>
            <Input id="name" name="name" defaultValue={product?.name} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">Kategori</Label>
              <Input id="category" name="category" defaultValue={product?.category ?? ""} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="basePrice">Harga Jual (Rp)</Label>
              <Input
                id="basePrice"
                name="basePrice"
                type="number"
                defaultValue={product?.basePrice ?? ""}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hppTarget">Target HPP (Rp)</Label>
              <Input
                id="hppTarget"
                name="hppTarget"
                type="number"
                defaultValue={product?.hppTarget ?? ""}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
            <Label htmlFor="isActive-switch">Produk Aktif</Label>
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
