"use client";

import { useState, useTransition } from "react";
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
import { DateInput } from "@/components/forms/date-input";
import { LiveEntriesTable } from "@/components/forms/live-entries-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createLiveSession } from "../../actions";

type Option = { id: string; name: string };
type ChannelOption = Option & { requiresDisbursement: boolean | null };
type ProductOption = Option & { basePrice: string | null; avgCost: number };

export function LiveSessionForm({
  channels,
  products,
  accounts,
}: {
  channels: ChannelOption[];
  products: ProductOption[];
  accounts: Option[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [total, setTotal] = useState(0);
  const [profit, setProfit] = useState(0);
  const [isPending, startTransition] = useTransition();

  const selectedChannel = channels.find((c) => c.id === channelId);
  const needsAccount = selectedChannel ? selectedChannel.requiresDisbursement === false : false;

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createLiveSession(formData);
          if (result?.error) {
            toast.error(result.error);
            setError(result.error);
          }
        });
      }}
      className="space-y-4"
    >
      <Card>
        <CardHeader>
          <CardTitle>Info Sesi Live</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <DateInput
            name="sessionDate"
            label="Tanggal"
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
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
          <div className="space-y-1.5">
            <Label htmlFor="hostName">Host</Label>
            <Input id="hostName" name="hostName" />
          </div>
        </CardContent>
      </Card>

      {needsAccount && (
        <Card>
          <CardContent className="space-y-1.5 pt-6">
            <Label>Akun Tujuan</Label>
            <p className="text-xs text-muted">
              Channel ini uangnya diterima langsung — pilih akun kas/bank yang menerima.
            </p>
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Produk Terjual</CardTitle>
        </CardHeader>
        <CardContent>
          <LiveEntriesTable
            name="entriesJson"
            products={products}
            onTotalChange={setTotal}
            onProfitChange={setProfit}
          />
          <div className="mt-3 flex flex-wrap items-center justify-end gap-4 text-sm">
            <span className="inline-flex items-center gap-1 text-muted">
              Estimasi Profit
              <InfoTooltip>
                Harga jual dikurangi HPP produk (rata-rata biaya produksi dari batch yang sudah
                selesai) untuk tiap baris, dijumlahkan. Belum memperhitungkan fee platform.
              </InfoTooltip>
              :{" "}
              <span
                className={cn(
                  "font-mono-num text-base font-semibold",
                  profit < 0 ? "text-danger" : "text-success"
                )}
              >
                {formatIDR(profit)}
              </span>
            </span>
            <span className="text-muted">
              Total Bruto:{" "}
              <span className="font-mono-num text-base font-semibold text-ink">
                {formatIDR(total)}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catatan</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea name="notes" placeholder="Catatan tambahan (opsional)" />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending || !channelId || (needsAccount && !accountId)}>
          {isPending ? "Menyimpan..." : "Simpan Rekap Live"}
        </Button>
      </div>
    </form>
  );
}
