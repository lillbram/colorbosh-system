"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { removePin, setPin } from "./actions";

export function PinForm({ hasPin, enabled }: { hasPin: boolean; enabled: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!enabled) {
    return (
      <Card className="max-w-md p-4 text-sm text-muted">
        Kunci PIN belum aktif di server. Minta pengelola aplikasi mengisi variabel
        <code className="mx-1 rounded bg-black/5 px-1">LOCK_SECRET</code> di pengaturan hosting.
      </Card>
    );
  }

  return (
    <Card className="max-w-md space-y-4 p-4">
      <p className="text-sm text-muted">
        {hasPin
          ? "PIN aktif. Aplikasi terkunci setelah 5 menit tidak dipakai. Isi di bawah untuk mengganti PIN."
          : "Setelah PIN dibuat, aplikasi terkunci otomatis setelah 5 menit tidak dipakai. Lupa PIN? Masuk lagi dengan email dan password."}
      </p>
      <form
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await setPin(formData);
            if (result?.error) setError(result.error);
            else toast.success(hasPin ? "PIN diganti" : "PIN dibuat");
          });
        }}
        className="space-y-3"
      >
        <div className="space-y-1.5">
          <Label htmlFor="pin">PIN baru (6 angka)</Label>
          <Input id="pin" name="pin" type="password" inputMode="numeric" maxLength={6} pattern="\d{6}" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm">Ulangi PIN</Label>
          <Input id="confirm" name="confirm" type="password" inputMode="numeric" maxLength={6} pattern="\d{6}" required />
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Menyimpan..." : hasPin ? "Ganti PIN" : "Buat PIN"}
          </Button>
          {hasPin && (
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await removePin();
                  toast.success("PIN dihapus");
                })
              }
            >
              Hapus PIN
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
