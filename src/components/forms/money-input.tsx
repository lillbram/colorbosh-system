"use client";

import { useState, useId } from "react";
import { cn } from "@/lib/utils";

function formatThousands(digits: string): string {
  if (!digits) return "";
  return Number(digits).toLocaleString("id-ID");
}

export function MoneyInput({
  name,
  defaultValue,
  label,
  required,
  className,
  onValueChange,
  applyValue,
}: {
  name: string;
  defaultValue?: number | string | null;
  label?: string;
  required?: boolean;
  className?: string;
  onValueChange?: (value: number) => void;
  /** Set this to a new number to programmatically overwrite the field (e.g. from a cost estimator). */
  applyValue?: number;
}) {
  const id = useId();
  const initialDigits = defaultValue ? String(defaultValue).replace(/[^\d]/g, "") : "";
  const [display, setDisplay] = useState(formatThousands(initialDigits));
  const [raw, setRaw] = useState(initialDigits);
  const [appliedValue, setAppliedValue] = useState(applyValue);

  if (applyValue !== undefined && applyValue !== appliedValue) {
    setAppliedValue(applyValue);
    const digits = String(Math.max(0, Math.round(applyValue)));
    setRaw(digits);
    setDisplay(formatThousands(digits));
  }

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
      )}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
          Rp
        </span>
        <input
          id={id}
          inputMode="numeric"
          value={display}
          required={required}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, "").slice(0, 9);
            setRaw(digits);
            setDisplay(digits);
            onValueChange?.(Number(digits));
          }}
          onBlur={() => setDisplay(formatThousands(raw))}
          onFocus={() => setDisplay(raw)}
          className={cn(
            "flex h-10 w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-right font-mono-num text-sm text-ink outline-none focus-visible:border-primary-500 focus-visible:ring-2 focus-visible:ring-primary-500/20",
            className
          )}
        />
        <input type="hidden" name={name} value={raw} />
      </div>
    </div>
  );
}
