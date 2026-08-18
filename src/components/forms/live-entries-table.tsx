"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

type Row = { productId: string; qty: string; unitPrice: string };

const EMPTY_ROW: Row = { productId: "", qty: "", unitPrice: "" };
const DRAFT_KEY = "live-entries-draft";

function isComplete(row: Row) {
  return row.productId !== "" && Number(row.qty) > 0 && row.unitPrice !== "";
}

export function LiveEntriesTable({
  name,
  products,
  onTotalChange,
  onProfitChange,
}: {
  name: string;
  products: { id: string; name: string; basePrice: string | null; avgCost?: number }[];
  onTotalChange?: (total: number) => void;
  onProfitChange?: (profit: number) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() => {
    if (typeof window === "undefined") return [EMPTY_ROW];
    const saved = window.localStorage.getItem(DRAFT_KEY);
    if (!saved) return [EMPTY_ROW];
    try {
      const parsed = JSON.parse(saved) as Row[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [EMPTY_ROW];
    } catch {
      return [EMPTY_ROW];
    }
  });

  useEffect(() => {
    const interval = setInterval(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(rows));
    }, 30_000);
    return () => clearInterval(interval);
  }, [rows]);

  useEffect(() => {
    const total = rows.reduce(
      (sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unitPrice) || 0),
      0
    );
    onTotalChange?.(total);

    const profit = rows.reduce((sum, r) => {
      const avgCost = products.find((p) => p.id === r.productId)?.avgCost ?? 0;
      return sum + (Number(r.qty) || 0) * ((Number(r.unitPrice) || 0) - avgCost);
    }, 0);
    onProfitChange?.(profit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, onTotalChange, onProfitChange]);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, EMPTY_ROW]);
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border/70">
        <table className="w-full text-sm">
          <thead className="border-b border-border/70 bg-canvas/60">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-muted">
                Produk
              </th>
              <th className="w-24 px-3 py-2 text-left text-xs font-medium uppercase text-muted">
                Qty
              </th>
              <th className="w-36 px-3 py-2 text-left text-xs font-medium uppercase text-muted">
                Harga Satuan
              </th>
              <th className="w-36 px-3 py-2 text-right text-xs font-medium uppercase text-muted">
                Subtotal
              </th>
              <th className="w-32 px-3 py-2 text-right text-xs font-medium uppercase text-muted">
                Profit
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const subtotal = (Number(row.qty) || 0) * (Number(row.unitPrice) || 0);
              const complete = isComplete(row);
              const avgCost = products.find((p) => p.id === row.productId)?.avgCost ?? 0;
              const rowProfit = (Number(row.qty) || 0) * ((Number(row.unitPrice) || 0) - avgCost);

              return (
                <tr
                  key={index}
                  className={cn(
                    "border-b border-border/40 last:border-0",
                    !complete && "bg-warning/5"
                  )}
                >
                  <td className="p-1.5">
                    <Select
                      value={row.productId}
                      onValueChange={(v) => {
                        const product = products.find((p) => p.id === v);
                        updateRow(index, {
                          productId: v,
                          unitPrice: product?.basePrice
                            ? String(Math.round(Number(product.basePrice)))
                            : row.unitPrice,
                        });
                      }}
                    >
                      <SelectTrigger className="h-9">
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
                  </td>
                  <td className="p-1.5">
                    <Input
                      className="h-9"
                      type="number"
                      value={row.qty}
                      onChange={(e) => updateRow(index, { qty: e.target.value })}
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      className="h-9"
                      type="number"
                      value={row.unitPrice}
                      onChange={(e) => updateRow(index, { unitPrice: e.target.value })}
                    />
                  </td>
                  <td className="p-1.5 text-right font-mono-num">{formatIDR(subtotal)}</td>
                  <td
                    className={cn(
                      "p-1.5 text-right font-mono-num text-xs",
                      row.productId && (rowProfit < 0 ? "text-danger" : "text-success")
                    )}
                  >
                    {row.productId ? formatIDR(rowProfit) : "-"}
                  </td>
                  <td className="p-1.5 text-center">
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeRow(index)}>
                      <Trash2 className="size-4 text-danger" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="size-4" />
        Tambah Baris
      </Button>

      <input type="hidden" name={name} value={JSON.stringify(rows.filter(isComplete))} />
    </div>
  );
}
