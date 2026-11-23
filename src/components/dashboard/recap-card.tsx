"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateRecap, type Recap } from "@/app/(dashboard)/ask/actions";

const KEY = "recap.v1";

/** Owner-only "Ringkasan Harian": generated on demand, cached in the browser for the day to avoid repeat cost. */
export function RecapCard({ enabled, today }: { enabled: boolean; today: string }) {
  const [recap, setRecap] = useState<Recap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
      if (saved?.date === today) setRecap(saved.recap);
    } catch {}
  }, [today]);

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await generateRecap();
      if (res.ok) {
        setRecap(res.recap);
        try {
          localStorage.setItem(KEY, JSON.stringify({ date: today, recap: res.recap }));
        } catch {}
      } else setError(res.error);
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-1.5">
          <Sparkles className="size-4 text-accent-500" />
          Ringkasan Harian
        </CardTitle>
        {enabled && (
          <Button size="sm" variant="outline" disabled={isPending} onClick={run}>
            {isPending ? "Membuat…" : recap ? "Perbarui" : "Buat Ringkasan"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!enabled && (
          <p className="text-muted">Belum aktif — butuh ANTHROPIC_API_KEY di pengaturan server.</p>
        )}
        {error && <p className="text-danger">{error}</p>}
        {!recap && enabled && !error && !isPending && (
          <p className="text-muted">Klik &ldquo;Buat Ringkasan&rdquo; untuk ringkasan angka hari ini dan hal yang perlu dicek.</p>
        )}
        {recap && (
          <>
            <ul className="list-disc space-y-1 pl-5 text-ink">
              {recap.summary.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
            {recap.anomalies.length > 0 && (
              <div className="space-y-1 rounded-lg bg-warning/5 p-3">
                {recap.anomalies.map((a, i) => (
                  <p key={i} className="flex items-start gap-1.5 text-warning">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span className="text-ink">{a.detail}</span>
                  </p>
                ))}
              </div>
            )}
            {recap.actions.length > 0 && (
              <div>
                <p className="font-medium text-ink">Langkah berikutnya</p>
                <ul className="list-disc space-y-1 pl-5 text-muted">
                  {recap.actions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
