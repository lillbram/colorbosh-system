"use client";

import * as React from "react";
import { DayPicker } from "react-day-picker";
import { id } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-day-picker/style.css";

function Calendar({
  className,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={id}
      showOutsideDays
      className={cn("p-1", className)}
      classNames={{
        month_caption: "flex justify-center py-1 text-sm font-semibold text-ink",
        nav: "flex items-center justify-between",
        button_previous:
          "absolute left-1 top-1 rounded-md p-1 text-muted hover:bg-canvas",
        button_next: "absolute right-1 top-1 rounded-md p-1 text-muted hover:bg-canvas",
        day: "text-sm",
        today: "font-semibold text-primary-600",
        selected: "bg-primary-500 text-white rounded-md",
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
