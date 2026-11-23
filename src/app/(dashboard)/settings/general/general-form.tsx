"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveGeneralSettings } from "./actions";

type Initial = { salaryPct: number; returnReservePct: number; capitalReservePct: number; lowStockThreshold: number };

export function GeneralForm({ initial }: { initial: Initial }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const field = (id: keyof Initial, label: string, hint: string, step = "0.01") => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type="number" step={step} min={0} defaultValue={initial[id]} required />
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );

  return (
    <Card className="max-w-md p-4">
      <form
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await saveGeneralSettings(formData);
            if (result?.error) setError(result.error);
            else toast.success("Pengaturan disimpan");
          });
        }}
        className="space-y-4"
      >
        {field("salaryPct", "Persen gaji (%)", "Bagian Laba Bersih bulanan yang jadi hak gaji admin. 100 = seluruh laba bersih.")}
        {field("returnReservePct", "Cadangan retur (%)", "Info saja di Modal Berjalan: persen dari Laba Bersih yang disisihkan untuk retur.")}
        {field("capitalReservePct", "Cadangan modal (%)", "Info saja di Modal Berjalan: persen dari Laba Bersih yang disisihkan untuk modal.")}
        {field("lowStockThreshold", "Batas stok menipis (pcs)", "Produk dengan stok sama atau di bawah angka ini diberi tanda Menipis.", "1")}
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Menyimpan..." : "Simpan"}
        </Button>
      </form>
    </Card>
  );
}
