"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/forms/date-input";
import { cn } from "@/lib/utils";
import { confirmOpname } from "../actions";

type Item = { productId: string; name: string; sku: string | null; system: number };

export function OpnameForm({
  items,
  missingOpening,
  today,
}: {
  items: Item[];
  missingOpening: string[];
  today: string;
}) {
  const router = useRouter();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  const filled = items.filter((i) => counts[i.productId] !== undefined && counts[i.productId] !== "");
  const withDiff = filled.filter((i) => Number(counts[i.productId]) !== i.system);

  return (
    <div className="space-y-4">
      {missingOpening.length > 0 && (
        <Card className="border-warning/40 bg-warning/5 p-4 text-sm text-ink">
          Atur stok awal dulu di halaman Stok untuk: {missingOpening.join(", ")}.
        </Card>
      )}

      <Card className="max-w-sm p-4">
        <DateInput name="opnameDate" label="Tanggal hitung" defaultValue={today} />
      </Card>

      <Card className="divide-y divide-border/70">
        {items.map((i) => {
          const raw = counts[i.productId] ?? "";
          const diff = raw === "" ? null : Number(raw) - i.system;
          return (
            <div key={i.productId} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{i.name}</p>
                <p className="text-xs text-muted">
                  {i.sku ?? "-"} · sistem: <span className="font-mono-num">{i.system}</span>
                </p>
              </div>
              <Input
                aria-label={`Stok fisik ${i.name}`}
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Fisik"
                className="w-24 text-right"
                value={raw}
                onChange={(e) => setCounts((c) => ({ ...c, [i.productId]: e.target.value }))}
              />
              <span
                className={cn(
                  "w-16 text-right font-mono-num text-sm",
                  diff === null || diff === 0 ? "text-muted" : diff < 0 ? "text-danger" : "text-success"
                )}
              >
                {diff === null ? "" : diff > 0 ? `+${diff}` : diff}
              </span>
            </div>
          );
        })}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {filled.length} produk dihitung, {withDiff.length} berselisih.
        </p>
        <Button
          disabled={filled.length === 0 || isPending}
          onClick={() =>
            startTransition(async () => {
              const dateValue =
                (document.querySelector('input[name="opnameDate"]') as HTMLInputElement | null)?.value || today;
              const result = await confirmOpname({
                date: dateValue,
                counts: filled.map((i) => ({ productId: i.productId, physical: Number(counts[i.productId]) })),
              });
              if (result?.error) toast.error(result.error);
              else {
                toast.success(`Opname disimpan, ${result.changed} produk disesuaikan`);
                router.push("/stock");
              }
            })
          }
        >
          {isPending ? "Menyimpan..." : "Konfirmasi Opname"}
        </Button>
      </div>
    </div>
  );
}
