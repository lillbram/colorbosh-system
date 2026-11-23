"use client";

import { useRef, useState, useTransition } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { askFinance } from "./actions";

type Msg = { role: "user" | "assistant"; content: string };

const EXAMPLES = [
  "Berapa laba bersih bulan lalu?",
  "Modal berjalan sekarang berapa?",
  "Gaji bulan ini sudah dibayar berapa?",
  "Stok apa yang mau habis?",
];

export function AskChat({ enabled }: { enabled: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  function send(text: string) {
    const question = text.trim();
    if (!question || isPending) return;
    const next = [...messages, { role: "user" as const, content: question }];
    setMessages(next);
    setInput("");
    setError(null);
    startTransition(async () => {
      const res = await askFinance(next);
      if (res.ok) setMessages((m) => [...m, { role: "assistant", content: res.answer }]);
      else setError(res.error);
      setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 50);
    });
  }

  if (!enabled) {
    return (
      <Card className="max-w-xl p-4 text-sm text-muted">
        Fitur ini belum aktif. Isi variabel <code className="rounded bg-black/5 px-1">ANTHROPIC_API_KEY</code> di
        pengaturan server (Vercel), lalu deploy ulang.
      </Card>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      {messages.length === 0 && (
        <Card className="space-y-2 p-4">
          <p className="text-sm text-muted">Contoh pertanyaan:</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                className="rounded-full border border-border px-3 py-1 text-sm text-ink hover:bg-canvas"
              >
                {q}
              </button>
            ))}
          </div>
        </Card>
      )}

      {messages.map((m, i) => (
        <div
          key={i}
          className={cn(
            "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm",
            m.role === "user" ? "self-end bg-primary-500 text-white" : "self-start bg-white text-ink shadow-sm"
          )}
        >
          {m.content}
        </div>
      ))}
      {isPending && <p className="self-start text-sm text-muted">Mengecek data…</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      <div ref={bottom} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-20 flex gap-2 md:bottom-4"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanya sesuatu tentang keuangan…"
          maxLength={500}
          className="bg-white"
        />
        <Button type="submit" size="icon" disabled={isPending || !input.trim()} aria-label="Kirim">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
