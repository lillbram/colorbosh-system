"use client";

import { useState } from "react";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

type CostComponentOption = {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitCost: string;
};

type Row = {
  componentId: string; // "" = belum dipilih, "custom" = Biaya Tambahan freeform
  qty: string;
  customLabel: string;
  customAmount: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  fabric: "Kain",
  accessory: "Hiasan",
  packaging: "Plastik Packing",
  labor: "Ongkos Jahit",
  other: "Lainnya",
};

const EMPTY_ROW: Row = { componentId: "", qty: "", customLabel: "", customAmount: "" };

export type CostItemPayload = {
  costComponentId?: string;
  label: string;
  qty?: number;
  unitCost?: number;
  subtotal: number;
  isAdditional: boolean;
};

export function CostItemsTable({
  name,
  components,
  onTotalChange,
}: {
  name: string;
  components: CostComponentOption[];
  onTotalChange?: (total: number) => void;
}) {
  const [rows, setRows] = useState<Row[]>([EMPTY_ROW]);
  const componentById = new Map(components.map((c) => [c.id, c]));

  function subtotalOf(row: Row): number {
    if (row.componentId === "custom") return Number(row.customAmount) || 0;
    const comp = componentById.get(row.componentId);
    if (!comp) return 0;
    return Number(comp.unitCost) * (Number(row.qty) || 0);
  }

  function toPayload(row: Row): CostItemPayload | null {
    const subtotal = subtotalOf(row);
    if (row.componentId === "custom") {
      if (!row.customLabel || subtotal <= 0) return null;
      return { label: row.customLabel, subtotal, isAdditional: true };
    }
    const comp = componentById.get(row.componentId);
    if (!comp || !(Number(row.qty) > 0)) return null;
    return {
      costComponentId: comp.id,
      label: comp.name,
      qty: Number(row.qty),
      unitCost: Number(comp.unitCost),
      subtotal,
      isAdditional: false,
    };
  }

  function emit(nextRows: Row[]) {
    setRows(nextRows);
    onTotalChange?.(nextRows.reduce((sum, r) => sum + subtotalOf(r), 0));
  }

  function updateRow(index: number, patch: Partial<Row>) {
    emit(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    emit([...rows, EMPTY_ROW]);
  }

  function removeRow(index: number) {
    emit(rows.length > 1 ? rows.filter((_, i) => i !== index) : rows);
  }

  const payloadRows = rows.map(toPayload).filter((r): r is CostItemPayload => r !== null);
  const total = payloadRows.reduce((sum, r) => sum + r.subtotal, 0);

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-canvas/40 p-3">
      <div className="flex items-center gap-1.5 text-sm font-medium text-ink">
        <Calculator className="size-4 text-primary-500" />
        Rincian Biaya Produksi
      </div>

      {components.length === 0 && (
        <p className="text-xs text-muted">
          Belum ada komponen biaya di katalog. Tambahkan di{" "}
          <a href="/settings/cost-components" className="font-medium text-primary-600 hover:underline">
            Pengaturan → Komponen Biaya Produksi
          </a>{" "}
          — atau pakai baris &quot;Biaya Tambahan&quot; di bawah untuk input manual.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row, index) => {
          const isCustom = row.componentId === "custom";
          const comp = componentById.get(row.componentId);
          const subtotal = subtotalOf(row);
          return (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <Select value={row.componentId} onValueChange={(v) => updateRow(index, { componentId: v })}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Pilih komponen" />
                  </SelectTrigger>
                  <SelectContent>
                    {components.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {CATEGORY_LABEL[c.category] ?? c.category} — {c.name} ({formatIDR(Number(c.unitCost))}/{c.unit})
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Biaya Tambahan (lainnya)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isCustom ? (
                <>
                  <Input
                    className="h-9 flex-1"
                    placeholder="Label biaya (mis. Ongkos kirim)"
                    value={row.customLabel}
                    onChange={(e) => updateRow(index, { customLabel: e.target.value })}
                  />
                  <Input
                    className="h-9 w-32"
                    type="number"
                    placeholder="Rp"
                    value={row.customAmount}
                    onChange={(e) => updateRow(index, { customAmount: e.target.value })}
                  />
                </>
              ) : (
                <>
                  <Input
                    className="h-9 w-24"
                    type="number"
                    placeholder={comp ? comp.unit : "Qty"}
                    value={row.qty}
                    onChange={(e) => updateRow(index, { qty: e.target.value })}
                  />
                  <span
                    className={cn(
                      "w-28 shrink-0 text-right text-xs font-mono-num",
                      subtotal > 0 ? "text-ink" : "text-muted"
                    )}
                  >
                    {formatIDR(subtotal)}
                  </span>
                </>
              )}

              <Button type="button" size="icon" variant="ghost" onClick={() => removeRow(index)}>
                <Trash2 className="size-4 text-danger" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border/70 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" />
          Tambah Biaya
        </Button>
        <span className="text-sm text-muted">
          Total: <span className="font-mono-num text-base font-bold text-ink">{formatIDR(total)}</span>
        </span>
      </div>

      <input type="hidden" name={name} value={JSON.stringify(payloadRows)} />
    </div>
  );
}
