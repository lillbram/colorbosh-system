"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
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
import { TrendingUp } from "lucide-react";
import { DateInput } from "@/components/forms/date-input";
import { MoneyInput } from "@/components/forms/money-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoTooltip } from "@/components/shared/info-tooltip";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createManualSale } from "../../actions";

type Option = { id: string; name: string };
type ChannelOption = Option & { requiresDisbursement: boolean | null };
type ProductOption = Option & { basePrice: string | null; avgCost: number };

export function ManualSaleForm({
  channels,
  products,
  accounts,
}: {
  channels: ChannelOption[];
  products: ProductOption[];
  accounts: Option[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [channelId, setChannelId] = useState("");
  const [productId, setProductId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [qty, setQty] = useState("");
  const [grossEdited, setGrossEdited] = useState(false);
  const [grossValue, setGrossValue] = useState(0);
  const [discountValue, setDiscountValue] = useState(0);
  const [isPending, startTransition] = useTransition();

  const selectedChannel = channels.find((c) => c.id === channelId);
  const needsAccount = selectedChannel ? selectedChannel.requiresDisbursement === false : false;
  const selectedProduct = products.find((p) => p.id === productId);
  const suggestedGross =
    selectedProduct?.basePrice && Number(qty) > 0
      ? Math.round(Number(selectedProduct.basePrice) * Number(qty))
      : 0;
  const effectiveGross = grossEdited ? grossValue : suggestedGross;
  const avgCost = selectedProduct?.avgCost ?? 0;
  const estimatedProfit = effectiveGross - discountValue - avgCost * (Number(qty) || 0);

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createManualSale(formData);
          if (result?.error) {
            toast.error(result.error);
            setError(result.error);
          } else {
            toast.success("Penjualan dicatat");
            router.push("/sales");
          }
        });
      }}
      className="space-y-4"
    >
      <Card>
        <CardHeader>
          <CardTitle>Order Sporadis / Koreksi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DateInput
              name="entryDate"
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
          </div>

          {needsAccount && (
            <div className="space-y-1.5 rounded-lg border border-border/70 bg-canvas/40 p-3">
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
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Produk</Label>
            <Select
              value={productId}
              onValueChange={(v) => {
                setProductId(v);
                setGrossEdited(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih produk" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="productId" value={productId} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qty">Qty</Label>
              <Input
                id="qty"
                name="qty"
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <MoneyInput
                name="grossAmount"
                label="Total Bruto"
                required
                applyValue={grossEdited ? undefined : suggestedGross}
                onValueChange={(v) => {
                  setGrossEdited(true);
                  setGrossValue(v);
                }}
              />
              {selectedProduct?.basePrice && (
                <p className="text-xs text-muted">
                  Saran otomatis: {formatIDR(suggestedGross)} ({formatIDR(Number(selectedProduct.basePrice))}/pcs)
                  {grossEdited && (
                    <button
                      type="button"
                      className="ml-1.5 font-medium text-primary-600 hover:underline"
                      onClick={() => setGrossEdited(false)}
                    >
                      Pakai saran
                    </button>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyInput
              name="discount"
              label="Diskon (opsional)"
              onValueChange={setDiscountValue}
            />
            <div className="space-y-1.5">
              <Label htmlFor="orderRef">No. Order (opsional)</Label>
              <Input id="orderRef" name="orderRef" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="buyerNote">Catatan Pembeli</Label>
            <Textarea id="buyerNote" name="buyerNote" />
          </div>
        </CardContent>
      </Card>

      {productId && (
        <Card className="border-primary-200 bg-primary-50/40">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-1.5 text-sm text-muted">
              <TrendingUp className="size-4" />
              <span>Estimasi Profit</span>
              <InfoTooltip>
                Harga Jual (Total Bruto dikurangi Diskon) dikurangi HPP produk ini (rata-rata
                biaya produksi dari batch yang sudah selesai) × Qty. Belum memperhitungkan fee
                platform — angka ini untuk gambaran cepat saat input, bukan angka final (lihat
                Laporan untuk Profit Estimasi yang sudah bersih dari fee).
              </InfoTooltip>
              {avgCost === 0 && (
                <span className="text-xs text-warning">(HPP belum ada data produksi)</span>
              )}
            </div>
            <span
              className={cn(
                "font-mono-num text-lg font-bold",
                estimatedProfit < 0 ? "text-danger" : "text-success"
              )}
            >
              {formatIDR(estimatedProfit)}
            </span>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isPending || !channelId || !productId || (needsAccount && !accountId)}
        >
          {isPending ? "Menyimpan..." : "Simpan Penjualan"}
        </Button>
      </div>
    </form>
  );
}
