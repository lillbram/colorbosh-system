"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatIDR } from "@/lib/format";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmCancelButton } from "@/components/shared/confirm-cancel-button";
import { createPosOrder, cancelPosOrder } from "../../actions";

type Product = { id: string; name: string; sku: string | null; basePrice: string | null };
type Channel = { id: string; name: string; requiresDisbursement: boolean | null };
type Account = { id: string; name: string };
type CartItem = { productId: string; name: string; qty: number; unitPrice: number };
type TodayOrder = {
  orderRef: string;
  channelName: string | null;
  createdAt: string;
  items: { productName: string; qty: number; grossAmount: number }[];
  total: number;
};

export function PosClient({
  products,
  channels,
  accounts,
  todayOrders,
}: {
  products: Product[];
  channels: Channel[];
  accounts: Account[];
  todayOrders: TodayOrder[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [accountId, setAccountId] = useState("");
  const [buyerNote, setBuyerNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const selectedChannel = channels.find((c) => c.id === channelId);
  const needsAccount = selectedChannel ? selectedChannel.requiresDisbursement === false : false;

  const filteredProducts = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    );
  }, [products, search]);

  const total = cart.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          qty: 1,
          unitPrice: Number(product.basePrice ?? 0),
        },
      ];
    });
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, qty } : i)));
  }

  function updatePrice(productId: string, unitPrice: number) {
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, unitPrice } : i)));
  }

  function removeItem(productId: string) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  function handleSave() {
    if (cart.length === 0 || !channelId || (needsAccount && !accountId)) return;

    const formData = new FormData();
    formData.set("channelId", channelId);
    formData.set("accountId", accountId);
    formData.set("buyerNote", buyerNote);
    formData.set(
      "itemsJson",
      JSON.stringify(cart.map((i) => ({ productId: i.productId, qty: i.qty, unitPrice: i.unitPrice })))
    );

    startTransition(async () => {
      const result = await createPosOrder(formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(`Order ${result.orderRef} tersimpan`);
        setCart([]);
        setBuyerNote("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {/* Product picker */}
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input
                placeholder="Cari produk atau SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {filteredProducts.length === 0 ? (
          <Card className="p-6">
            <EmptyState
              icon={ShoppingCart}
              title="Produk tidak ditemukan"
              description="Coba kata kunci lain, atau tambahkan produk baru di Pengaturan > Produk."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addToCart(p)}
                className="flex flex-col items-start gap-1 rounded-card border border-border/70 bg-white p-3 text-left transition-shadow hover:shadow-md"
              >
                <p className="text-sm font-medium text-ink">{p.name}</p>
                {p.sku && <p className="text-xs text-muted">{p.sku}</p>}
                <p className="font-mono-num mt-1 text-sm font-semibold text-primary-600">
                  {formatIDR(Number(p.basePrice ?? 0))}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cart + recap */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>
              <ShoppingCart className="size-4 text-primary-500" />
              Order Saat Ini
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
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
            </div>

            {needsAccount && (
              <div className="space-y-1.5 rounded-lg border border-border/70 bg-canvas/40 p-2.5">
                <p className="text-xs text-muted">
                  Channel ini uangnya diterima langsung — pilih akun tujuan.
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
              </div>
            )}

            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                Klik produk di sebelah kiri untuk menambah ke order.
              </p>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <div key={item.productId} className="rounded-lg border border-border/70 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-ink">{item.name}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
                        className="text-muted hover:text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => updateQty(item.productId, item.qty - 1)}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-8 text-center font-mono-num text-sm">{item.qty}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="size-7"
                          onClick={() => updateQty(item.productId, item.qty + 1)}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                      <Input
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => updatePrice(item.productId, Number(e.target.value) || 0)}
                        className="h-7 w-24 text-right font-mono-num text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Textarea
                placeholder="Catatan pembeli (opsional)"
                value={buyerNote}
                onChange={(e) => setBuyerNote(e.target.value)}
                className="min-h-16"
              />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-muted">Total</span>
              <span className="font-mono-num text-lg font-bold text-ink">{formatIDR(total)}</span>
            </div>

            <Button
              className="w-full"
              disabled={cart.length === 0 || !channelId || (needsAccount && !accountId) || isPending}
              onClick={handleSave}
            >
              {isPending ? "Menyimpan..." : "Simpan Order"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rekap Order Hari Ini</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayOrders.length === 0 ? (
              <p className="text-sm text-muted">Belum ada order hari ini.</p>
            ) : (
              todayOrders.map((o) => (
                <div key={o.orderRef} className="rounded-lg bg-canvas p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="neutral">{o.channelName ?? "-"}</Badge>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted">
                        {new Date(o.createdAt).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <ConfirmCancelButton
                        itemName="order ini"
                        size="icon"
                        onConfirm={cancelPosOrder.bind(null, o.orderRef)}
                      />
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    {o.items.map((i) => `${i.productName} x${i.qty}`).join(", ")}
                  </p>
                  <p className="font-mono-num mt-1 text-sm font-semibold text-ink">
                    {formatIDR(o.total)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
