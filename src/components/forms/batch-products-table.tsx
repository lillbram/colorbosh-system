"use client";

import { useState } from "react";
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

type Row = { productId: string; qty: string };

const EMPTY_ROW: Row = { productId: "", qty: "" };

export function BatchProductsTable({
  name,
  products,
}: {
  name: string;
  products: { id: string; name: string }[];
}) {
  const [rows, setRows] = useState<Row[]>([EMPTY_ROW]);

  function updateRow(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, EMPTY_ROW]);
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const validRows = rows.filter((r) => r.productId && Number(r.qty) > 0);
  const totalQty = validRows.reduce((sum, r) => sum + Number(r.qty), 0);

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="flex-1">
            <Select
              value={row.productId}
              onValueChange={(v) => updateRow(index, { productId: v })}
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
          </div>
          <Input
            className="h-9 w-28"
            type="number"
            placeholder="Qty"
            value={row.qty}
            onChange={(e) => updateRow(index, { qty: e.target.value })}
          />
          <Button type="button" size="icon" variant="ghost" onClick={() => removeRow(index)}>
            <Trash2 className="size-4 text-danger" />
          </Button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" />
          Tambah Produk
        </Button>
        <span className="text-sm text-muted">
          Total Qty: <span className="font-mono-num font-semibold text-ink">{totalQty} pcs</span>
        </span>
      </div>

      <input
        type="hidden"
        name={name}
        value={JSON.stringify(validRows.map((r) => ({ productId: r.productId, qty: r.qty })))}
      />
    </div>
  );
}
