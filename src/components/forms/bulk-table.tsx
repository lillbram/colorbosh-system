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

export type PoItemRow = {
  itemType: "fabric_roll" | "accessory" | "packaging" | "other";
  description: string;
  qtyOrdered: string;
  unit: string;
  unitPrice: string;
};

const EMPTY_ROW: PoItemRow = {
  itemType: "fabric_roll",
  description: "",
  qtyOrdered: "",
  unit: "pcs",
  unitPrice: "",
};

const ITEM_TYPE_LABEL: Record<PoItemRow["itemType"], string> = {
  fabric_roll: "Kain Roll",
  accessory: "Hiasan",
  packaging: "Plastik Packing",
  other: "Lainnya",
};

const DRAFT_KEY = "po-items-draft";

function isRowComplete(row: PoItemRow) {
  return row.description.trim() !== "" && Number(row.qtyOrdered) > 0 && row.unitPrice !== "";
}

export function BulkPoItemsTable({
  name,
  onTotalChange,
}: {
  name: string;
  onTotalChange?: (total: number) => void;
}) {
  const [rows, setRows] = useState<PoItemRow[]>(() => {
    if (typeof window === "undefined") return [EMPTY_ROW];
    const saved = window.localStorage.getItem(DRAFT_KEY);
    if (!saved) return [EMPTY_ROW];
    try {
      const parsed = JSON.parse(saved) as PoItemRow[];
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
      (sum, r) => sum + (Number(r.qtyOrdered) || 0) * (Number(r.unitPrice) || 0),
      0
    );
    onTotalChange?.(total);
  }, [rows, onTotalChange]);

  function updateRow(index: number, patch: Partial<PoItemRow>) {
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
                Jenis
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase text-muted">
                Deskripsi
              </th>
              <th className="w-24 px-3 py-2 text-left text-xs font-medium uppercase text-muted">
                Qty
              </th>
              <th className="w-20 px-3 py-2 text-left text-xs font-medium uppercase text-muted">
                Satuan
              </th>
              <th className="w-36 px-3 py-2 text-left text-xs font-medium uppercase text-muted">
                Harga Satuan
              </th>
              <th className="w-36 px-3 py-2 text-right text-xs font-medium uppercase text-muted">
                Subtotal
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const subtotal = (Number(row.qtyOrdered) || 0) * (Number(row.unitPrice) || 0);
              const complete = isRowComplete(row);

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
                      value={row.itemType}
                      onValueChange={(v) => updateRow(index, { itemType: v as PoItemRow["itemType"] })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ITEM_TYPE_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-1.5">
                    <Input
                      className="h-9"
                      value={row.description}
                      placeholder="mis. Kain rajut sage 50 roll"
                      onChange={(e) => updateRow(index, { description: e.target.value })}
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      className="h-9"
                      type="number"
                      value={row.qtyOrdered}
                      onChange={(e) => updateRow(index, { qtyOrdered: e.target.value })}
                    />
                  </td>
                  <td className="p-1.5">
                    <Input
                      className="h-9"
                      value={row.unit}
                      onChange={(e) => updateRow(index, { unit: e.target.value })}
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
                  <td className="p-1.5 text-center">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeRow(index)}
                    >
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

      <input type="hidden" name={name} value={JSON.stringify(rows.filter(isRowComplete))} />
    </div>
  );
}
