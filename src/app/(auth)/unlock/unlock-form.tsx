"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { logoutAction } from "@/lib/session-actions";
import { unlockAction } from "./actions";

export function UnlockForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await unlockAction(formData);
          if (result?.error) setError(result.error);
        });
      }}
      className="space-y-4"
    >
      <input type="hidden" name="next" value={next} />
      <Input
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        autoFocus
        maxLength={6}
        pattern="\d{6}"
        placeholder="••••••"
        aria-label="PIN 6 angka"
        className="text-center font-mono-num text-2xl tracking-[0.5em]"
        required
      />
      {error && <p className="text-sm text-danger">{error}</p>}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Membuka..." : "Buka"}
      </Button>
      <button
        type="button"
        onClick={() => logoutAction()}
        className="w-full text-center text-sm text-muted hover:text-ink"
      >
        Masuk dengan email dan password
      </button>
    </form>
  );
}
