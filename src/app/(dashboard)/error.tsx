"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
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
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-danger/10">
        <AlertTriangle className="size-6 text-danger" />
      </div>
      <p className="text-sm font-medium text-ink">Terjadi kesalahan saat memuat halaman</p>
      <p className="max-w-sm text-sm text-muted">
        Coba muat ulang. Jika masih terjadi, hubungi Owner atau admin sistem.
      </p>
      <Button size="sm" onClick={reset}>
        Coba Lagi
      </Button>
    </div>
  );
}
