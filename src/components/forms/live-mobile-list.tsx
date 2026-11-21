"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

type Product = { id: string; name: string; basePrice: string | null; avgCost?: number };

/**
 * Phone version of the Rekap Live table: every active product is listed with a
 * qty stepper (no add-row). Price starts at base_price and stays editable.
 * Writes the same `[{productId, qty, unitPrice}]` JSON as LiveEntriesTable.
 */
export function LiveMobileList({
  name,
  products,
  onTotalChange,
  onProfitChange,
}: {
  name: string;
  products: Product[];
  onTotalChange?: (total: number) => void;
  onProfitChange?: (profit: number) => void;
}) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [price, setPrice] = useState<Record<string, number>>({});

  const priceOf = (p: Product) => price[p.id] ?? Number(p.basePrice ?? 0);

  const entries = useMemo(
    () =>
      products
        .filter((p) => (qty[p.id] ?? 0) > 0)
        .map((p) => ({ productId: p.id, qty: qty[p.id], unitPrice: price[p.id] ?? Number(p.basePrice ?? 0) })),
    [products, qty, price]
  );
  const total = entries.reduce((s, e) => s + e.qty * e.unitPrice, 0);
  const pcs = entries.reduce((s, e) => s + e.qty, 0);
  const profit = entries.reduce(
    (s, e) => s + e.qty * (e.unitPrice - (products.find((p) => p.id === e.productId)?.avgCost ?? 0)),
    0
  );

  useEffect(() => {
    onTotalChange?.(total);
    onProfitChange?.(profit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total, profit]);

  const step = (id: string, delta: number) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={JSON.stringify(entries)} />
      {products.map((p) => {
        const n = qty[p.id] ?? 0;
        return (
          <div
            key={p.id}
            className={cn(
              "rounded-card border p-3",
              n > 0 ? "border-primary-500 bg-primary-50/40" : "border-border/70 bg-white"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{p.name}</p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-10"
                  aria-label={`Kurangi ${p.name}`}
                  disabled={n === 0}
                  onClick={() => step(p.id, -1)}
                >
                  <Minus className="size-4" />
                </Button>
                <span className="w-8 text-center font-mono-num text-lg font-bold">{n}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-10"
                  aria-label={`Tambah ${p.name}`}
                  onClick={() => step(p.id, 1)}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
            {n > 0 && (
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                <label className="flex items-center gap-1.5">
                  Harga
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={priceOf(p)}
                    onChange={(e) => setPrice((pr) => ({ ...pr, [p.id]: Number(e.target.value) || 0 }))}
                    className="h-8 w-28 text-right font-mono-num text-sm"
                  />
                </label>
                <span className="font-mono-num text-sm font-semibold text-ink">
                  {formatIDR(n * priceOf(p))}
                </span>
              </div>
            )}
          </div>
        );
      })}

      <div className="sticky bottom-20 rounded-card border border-border bg-white p-3 shadow-md">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">{pcs} pcs</span>
          <span className="font-mono-num text-lg font-bold text-ink">{formatIDR(total)}</span>
        </div>
      </div>
    </div>
  );
}
