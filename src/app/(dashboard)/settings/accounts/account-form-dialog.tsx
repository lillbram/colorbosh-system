"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createAccount, updateAccount } from "./actions";

type Account = {
  id: string;
  name: string;
  type: "bank" | "cash" | "e_wallet";
  openingBalance: string | null;
  isActive: boolean | null;
};

const TYPE_LABEL: Record<Account["type"], string> = {
  bank: "Rekening Bank",
  cash: "Kas Tunai",
  e_wallet: "E-Wallet",
};

export function AccountFormDialog({ account }: { account?: Account }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<Account["type"]>(account?.type ?? "bank");
  const [isActive, setIsActive] = useState(account?.isActive ?? true);
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(account);

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
            Tambah Akun
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah Akun" : "Akun Baru"}</DialogTitle>
        </DialogHeader>

        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = isEdit
                ? await updateAccount(account!.id, formData)
                : await createAccount(formData);
              if (result?.error) {
                setError(result.error);
              } else {
                toast.success(isEdit ? "Akun diperbarui" : "Akun ditambahkan");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Akun</Label>
            <Input id="name" name="name" defaultValue={account?.name} required />
          </div>
          <div className="space-y-1.5">
            <Label>Tipe</Label>
            <Select value={type} onValueChange={(v) => setType(v as Account["type"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="type" value={type} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="openingBalance">Saldo Awal (Rp)</Label>
            <Input
              id="openingBalance"
              name="openingBalance"
              type="number"
              defaultValue={account?.openingBalance ?? 0}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
            <Label htmlFor="isActive-switch">Akun Aktif</Label>
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
