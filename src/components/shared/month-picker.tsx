"use client";

import { useRouter } from "next/navigation";

export function MonthPicker({
  basePath,
  params,
  months,
  value,
}: {
  basePath: string;
  /** Query params to keep when the month changes (period/from/to are dropped by the caller). */
  params: Record<string, string>;
  months: { value: string; label: string }[];
  value: string | null;
}) {
  const router = useRouter();

  function onChange(next: string) {
    const qs = new URLSearchParams(params);
    if (next) qs.set("month", next);
    const q = qs.toString();
    router.push(q ? `${basePath}?${q}` : basePath);
  }

  return (
    <select
      aria-label="Pilih bulan"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 rounded-lg border px-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20 ${
        value ? "border-primary-500 bg-primary-50 text-primary-700" : "border-border bg-white text-muted"
      }`}
    >
      <option value="">Pilih bulan…</option>
      {months.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
  );
}
