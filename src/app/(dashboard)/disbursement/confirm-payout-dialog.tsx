"use client";

import { useState, useTransition } from "react";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { DateInput } from "@/components/forms/date-input";
import { MoneyInput } from "@/components/forms/money-input";
import { confirmPayout } from "./actions";

type Option = { id: string; name: string };

export function ConfirmPayoutDialog({
  channels,
  accounts,
}: {
  channels: Option[];
  accounts: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setChannelId("");
          setAccountId("");
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          <Wallet className="size-4" />
          Payout Diterima
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Konfirmasi Payout Diterima</DialogTitle>
        </DialogHeader>

        <form
          action={(formData) => {
            setError(null);
            startTransition(async () => {
              const result = await confirmPayout(formData);
              if (result?.error) {
                setError(result.error);
              } else {
                toast.success("Pencairan dana dicatat");
                setOpen(false);
              }
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Select value={channelId} onValueChange={setChannelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih channel" />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="channelId" value={channelId} />
            </div>
            <DateInput
              name="actualDate"
              label="Tanggal Cair"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
          </div>

          <MoneyInput name="actualAmount" label="Jumlah Diterima" required />

          <div className="space-y-1.5">
            <Label>Cairkan ke Akun</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih akun" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="accountId" value={accountId} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bankRef">No. Referensi Bank</Label>
            <Input id="bankRef" name="bankRef" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Catatan</Label>
            <Textarea id="notes" name="notes" />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending || !channelId || !accountId}>
              {isPending ? "Menyimpan..." : "Simpan Pencairan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
