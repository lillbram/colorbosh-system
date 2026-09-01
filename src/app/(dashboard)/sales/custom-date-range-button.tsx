"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function CustomDateRangeButton({
  baseQuery,
  active,
  initialFrom,
  initialTo,
}: {
  baseQuery: string;
  active: boolean;
  initialFrom?: string;
  initialTo?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: initialFrom ? new Date(initialFrom) : undefined,
    to: initialTo ? new Date(initialTo) : undefined,
  });

  function apply() {
    if (!range.from || !range.to) return;
    const params = new URLSearchParams(baseQuery);
    params.set("period", "custom");
    params.set("from", format(range.from, "yyyy-MM-dd"));
    params.set("to", format(range.to, "yyyy-MM-dd"));
    router.push(`/sales?${params.toString()}`);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
            active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
          )}
        >
          <CalendarRange className="size-3.5" />
          {active && initialFrom && initialTo
            ? `${formatDate(initialFrom)} - ${formatDate(initialTo)}`
            : "Custom"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <Calendar
          mode="range"
          selected={range}
          onSelect={(r) => setRange({ from: r?.from, to: r?.to })}
          numberOfMonths={2}
        />
        <div className="mt-2 flex justify-end gap-2 border-t border-border pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button type="button" size="sm" disabled={!range.from || !range.to} onClick={apply}>
            Terapkan
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
