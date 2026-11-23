"use client";

import { useTransition } from "react";
import * as XLSX from "xlsx";
import { Download, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { closeMonth, reopenMonth } from "./actions";

type Snapshot = {
  month: string;
  pnl: Record<string, number>;
  salary: { entitlement: number; paid: number; remaining: number } | null;
  capital: Record<string, number | string>;
};

export function CloseMonthButton({ month }: { month: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={isPending}
      onClick={() => {
        if (!confirm(`Kunci bulan ${month}? Perubahan data di bulan ini nanti hanya bisa dilakukan Owner dan tercatat di audit.`)) return;
        startTransition(async () => {
          const r = await closeMonth(month);
          if (r?.error) toast.error(r.error);
          else toast.success("Bulan dikunci");
        });
      }}
    >
      <Lock className="size-4" />
      Kunci bulan
    </Button>
  );
}

export function LockedMonthActions({ month, snapshot }: { month: string; snapshot: Snapshot }) {
  const [isPending, startTransition] = useTransition();

  function exportExcel() {
    const rows: { Item: string; Nominal: number | string }[] = [
      ...Object.entries(snapshot.pnl)
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => ({ Item: k, Nominal: v as number })),
      { Item: "Hak gaji", Nominal: snapshot.salary?.entitlement ?? 0 },
      { Item: "Gaji dibayar", Nominal: snapshot.salary?.paid ?? 0 },
      { Item: "Sisa gaji", Nominal: snapshot.salary?.remaining ?? 0 },
      ...Object.entries(snapshot.capital)
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => ({ Item: `modal.${k}`, Nominal: v as number })),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Tutup Buku");
    XLSX.writeFile(wb, `tutup-buku-${month}.xlsx`);
  }

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="outline" onClick={exportExcel}>
        <Download className="size-4" />
        Excel
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => {
          if (!confirm(`Buka kunci ${month}? Tercatat di audit.`)) return;
          startTransition(async () => {
            const r = await reopenMonth(month);
            if (r?.error) toast.error(r.error);
            else toast.success("Kunci dibuka");
          });
        }}
      >
        <Unlock className="size-4" />
        Buka
      </Button>
    </div>
  );
}
