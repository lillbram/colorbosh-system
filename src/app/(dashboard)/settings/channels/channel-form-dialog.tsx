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
import { createChannel, updateChannel } from "./actions";

type Channel = {
  id: string;
  name: string;
  type: "tiktok_live" | "tiktok_shop" | "shopee" | "other";
  defaultFeePct: string | null;
  defaultHoldDays: number | null;
  requiresDisbursement: boolean | null;
};

const TYPE_LABEL: Record<Channel["type"], string> = {
  tiktok_live: "TikTok Live",
  tiktok_shop: "TikTok Shop",
  shopee: "Shopee",
  other: "Lainnya",
};

export function ChannelFormDialog({ channel }: { channel?: Channel }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<Channel["type"]>(channel?.type ?? "other");
  const [requiresDisbursement, setRequiresDisbursement] = useState(
    channel?.requiresDisbursement ?? true
  );
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(channel);

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
            Tambah Channel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah Channel" : "Channel Baru"}</DialogTitle>
        </DialogHeader>

        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = isEdit
                ? await updateChannel(channel!.id, formData)
                : await createChannel(formData);
              if (result?.error) {
                setError(result.error);
              } else {
                toast.success(isEdit ? "Channel diperbarui" : "Channel ditambahkan");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Channel</Label>
            <Input id="name" name="name" defaultValue={channel?.name} required />
          </div>
          <div className="space-y-1.5">
            <Label>Tipe</Label>
            <Select value={type} onValueChange={(v) => setType(v as Channel["type"])}>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="defaultFeePct">Fee Default (%)</Label>
              <Input
                id="defaultFeePct"
                name="defaultFeePct"
                type="number"
                step="0.1"
                defaultValue={channel?.defaultFeePct ?? 0}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="defaultHoldDays">Hold Default (hari)</Label>
              <Input
                id="defaultHoldDays"
                name="defaultHoldDays"
                type="number"
                defaultValue={channel?.defaultHoldDays ?? 0}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
            <div>
              <Label htmlFor="requiresDisbursement-switch">Butuh Pencairan Dana?</Label>
              <p className="text-xs text-muted">
                Matikan untuk channel yang uangnya diterima langsung saat order (mis. Paket Usaha) —
                tidak akan muncul di Pencairan Dana, dan penjualan dari channel ini langsung tercatat
                sebagai uang masuk.
              </p>
            </div>
            <Switch
              id="requiresDisbursement-switch"
              checked={requiresDisbursement}
              onCheckedChange={setRequiresDisbursement}
            />
          </div>
          <input
            type="hidden"
            name="requiresDisbursement"
            value={requiresDisbursement ? "true" : "false"}
          />

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
