"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateInput } from "@/components/forms/date-input";
import { BulkPoItemsTable } from "@/components/forms/bulk-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIDR } from "@/lib/format";
import { createPurchaseOrder } from "../actions";

type Supplier = { id: string; name: string };

export function NewPoForm({ suppliers }: { suppliers: Supplier[] }) {
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [supplierId, setSupplierId] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await createPurchaseOrder(formData);
          if (result?.error) {
            toast.error(result.error);
            setError(result.error);
          }
        });
      }}
      className="space-y-4"
    >
      <Card>
        <CardHeader>
          <CardTitle>Detail Pemesanan</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Supplier</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih supplier" />
              </SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="supplierId" value={supplierId} />
          </div>
          <DateInput name="orderDate" label="Tanggal Pesan" defaultValue={new Date().toISOString().slice(0, 10)} />
          <DateInput name="expectedDate" label="Estimasi Tiba" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Item Pesanan</CardTitle>
        </CardHeader>
        <CardContent>
          <BulkPoItemsTable name="itemsJson" onTotalChange={setTotal} />
          <div className="mt-3 flex justify-end text-sm">
            <span className="text-muted">
              Total:{" "}
              <span className="font-mono-num text-base font-semibold text-ink">
                {formatIDR(total)}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catatan</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea name="notes" placeholder="Catatan tambahan (opsional)" />
        </CardContent>
      </Card>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isPending || !supplierId}>
          {isPending ? "Menyimpan..." : "Simpan Pemesanan"}
        </Button>
      </div>
    </form>
  );
}
