"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateInput } from "@/components/forms/date-input";
import { MoneyInput } from "@/components/forms/money-input";
import { BatchProductsTable } from "@/components/forms/batch-products-table";
import { CostItemsTable } from "@/components/forms/cost-items-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIDR } from "@/lib/format";
import { createProductionBatch } from "../actions";

type Tailor = { id: string; name: string; defaultTermin1Pct: number | null };
type Product = { id: string; name: string };
type CostComponent = { id: string; name: string; category: string; unit: string; unitCost: string };

export function NewBatchForm({
  tailors,
  products,
  costComponents,
}: {
  tailors: Tailor[];
  products: Product[];
  costComponents: CostComponent[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [tailorId, setTailorId] = useState("");
  const [tailorOwn, setTailorOwn] = useState(false);
  const [totalCost, setTotalCost] = useState(0);
  const [termin1Amount, setTermin1Amount] = useState(0);
  const [termin1Edited, setTermin1Edited] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedTailor = tailors.find((t) => t.id === tailorId);
  const termin1Pct = selectedTailor?.defaultTermin1Pct ?? 50;
  const suggestedTermin1 = Math.round((totalCost * termin1Pct) / 100);
  const effectiveTermin1 = termin1Edited ? termin1Amount : suggestedTermin1;
  const termin2Preview = Math.max(totalCost - effectiveTermin1, 0);

  return (
    <form
      action={(formData) => {
        setError(null);
        formData.set("fabricSource", tailorOwn ? "tailor_own" : "from_po");
        startTransition(async () => {
          const result = await createProductionBatch(formData);
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
          <CardTitle>Detail Batch</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Penjahit</Label>
              <Select value={tailorId} onValueChange={setTailorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih penjahit" />
                </SelectTrigger>
                <SelectContent>
                  {tailors.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="tailorId" value={tailorId} />
              {selectedTailor && (
                <p className="text-xs text-muted">
                  Termin 1 default: {selectedTailor.defaultTermin1Pct}%
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="fabricUsedMeters">Kain Terpakai (meter)</Label>
              <Input id="fabricUsedMeters" name="fabricUsedMeters" type="number" step="0.1" />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
            <div>
              <Label htmlFor="tailorOwn-switch">Kain Dibeli Penjahit Sendiri</Label>
              <p className="text-xs text-muted">
                Biaya kain akan digabung ke rincian biaya produksi di bawah, bukan Pemesanan Kain terpisah.
              </p>
            </div>
            <Switch id="tailorOwn-switch" checked={tailorOwn} onCheckedChange={setTailorOwn} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DateInput
              name="startDate"
              label="Tanggal Mulai"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
            <DateInput name="targetFinishDate" label="Target Selesai" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produk & Estimasi Qty</CardTitle>
        </CardHeader>
        <CardContent>
          <BatchProductsTable name="productsJson" products={products} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Biaya Produksi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CostItemsTable name="costItemsJson" components={costComponents} onTotalChange={setTotalCost} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Termin Pembayaran Penjahit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <MoneyInput
                name="termin1Amount"
                label="Termin 1 (Rp)"
                required
                applyValue={termin1Edited ? undefined : suggestedTermin1}
                onValueChange={(v) => {
                  setTermin1Amount(v);
                  setTermin1Edited(true);
                }}
              />
              <p className="text-xs text-muted">
                Saran otomatis: {formatIDR(suggestedTermin1)} ({termin1Pct}% dari total biaya)
                {termin1Edited && (
                  <button
                    type="button"
                    className="ml-1.5 font-medium text-primary-600 hover:underline"
                    onClick={() => setTermin1Edited(false)}
                  >
                    Pakai saran
                  </button>
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Termin 2 (estimasi sisa)</Label>
              <p className="flex h-10 items-center justify-end rounded-lg border border-border/70 bg-canvas/40 px-3 font-mono-num text-sm text-ink">
                {formatIDR(termin2Preview)}
              </p>
              <p className="text-xs text-muted">
                Dibuat otomatis saat batch ditandai selesai — sisa dari total biaya dikurangi Termin 1.
              </p>
            </div>
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

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending || !tailorId}>
          {isPending ? "Menyimpan..." : "Simpan Batch"}
        </Button>
      </div>
    </form>
  );
}
