"use client";

import { useId, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { subDays, startOfMonth, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "Hari ini", getValue: () => new Date() },
  { label: "Kemarin", getValue: () => subDays(new Date(), 1) },
  { label: "7 hari lalu", getValue: () => subDays(new Date(), 7) },
  { label: "Awal bulan", getValue: () => startOfMonth(new Date()) },
];

export function DateInput({
  name,
  defaultValue,
  label,
}: {
  name: string;
  defaultValue?: string | null;
  label?: string;
}) {
  const id = useId();
  const [date, setDate] = useState<Date | undefined>(
    defaultValue ? new Date(defaultValue) : undefined
  );
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-white px-3 text-left text-sm outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20",
              date ? "text-ink" : "text-muted"
            )}
          >
            <CalendarIcon className="size-4 text-muted" />
            {date ? formatDate(date) : "Pilih tanggal"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto">
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 border-r border-border pr-3">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    setDate(preset.getValue());
                    setOpen(false);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => {
                setDate(d);
                setOpen(false);
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
      <input type="hidden" name={name} value={date ? format(date, "yyyy-MM-dd") : ""} />
    </div>
  );
}
