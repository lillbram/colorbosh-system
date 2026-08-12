"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarIcon, Search, X } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function DateFilterButton({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-sm outline-none focus-visible:border-primary-500",
            value ? "text-ink" : "text-muted"
          )}
        >
          <CalendarIcon className="size-3.5" />
          {value ? formatDate(value) : placeholder}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <Calendar
          mode="single"
          selected={value ? new Date(value) : undefined}
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

export function ProductionFilters({
  initialQ,
  initialFrom,
  initialTo,
}: {
  initialQ: string;
  initialFrom: string;
  initialTo: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(initialQ);
  const [, startTransition] = useTransition();

  function pushParams(patch: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    startTransition(() => {
      router.push(`/production?${params.toString()}`);
    });
  }

  // Debounce text search so it doesn't push a route change on every keystroke.
  useEffect(() => {
    if (q === initialQ) return;
    const timeout = setTimeout(() => pushParams({ q }), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = initialQ || initialFrom || initialTo;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari kode batch atau penjahit..."
          className="h-9 w-56 pl-8"
        />
      </div>
      <DateFilterButton
        value={initialFrom}
        placeholder="Dari Tanggal"
        onChange={(v) => pushParams({ from: v })}
      />
      <DateFilterButton
        value={initialTo}
        placeholder="Sampai Tanggal"
        onChange={(v) => pushParams({ to: v })}
      />
      {hasFilters && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            pushParams({ q: "", from: "", to: "" });
          }}
        >
          <X className="size-3.5" />
          Reset
        </Button>
      )}
    </div>
  );
}
