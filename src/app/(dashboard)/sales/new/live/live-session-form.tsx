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
import { formatIDR } from "@/lib/format";
import { createLiveSession } from "../../actions";

type Option = { id: string; name: string };
type ProductOption = Option & { basePrice: string | null };

export function LiveSessionForm({ channels, products }: { channels: Option[]; products: ProductOption[] }) {
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState("");
  const [total, setTotal] = useState(0);
  const [isPending, startTransition] = useTransition();

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

      <Card>
        <CardHeader>
          <CardTitle>Produk Terjual</CardTitle>
        </CardHeader>
        <CardContent>
          <LiveEntriesTable name="entriesJson" products={products} onTotalChange={setTotal} />
          <div className="mt-3 flex justify-end text-sm">
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
        <Button type="submit" disabled={isPending || !channelId}>
          {isPending ? "Menyimpan..." : "Simpan Rekap Live"}
        </Button>
      </div>
    </form>
  );
}
