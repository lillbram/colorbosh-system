"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-card border border-border/70 bg-white p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger/10">
        <AlertTriangle className="size-6 text-danger" />
      </div>
      <p className="text-sm font-medium text-ink">Gagal memuat halaman</p>
      <p className="text-sm text-muted">Koneksi ke server bermasalah sesaat. Coba lagi.</p>
      <Button size="sm" onClick={reset}>
        Coba Lagi
      </Button>
    </div>
  );
}
