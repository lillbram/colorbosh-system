import { parseMoney } from "@/lib/brimo-statement";

/**
 * TikTok income/settlement workbook, sheet "Detail pesanan". Columns are read by
 * position (spec §Phase 3): A order id, D payment time (text YYYY/MM/DD),
 * F settlement amount, H subtotal after seller discount, O total fees (negative).
 * Every cell is TEXT, so ids stay exact. Pure, no DB.
 */
export type SettlementRow = {
  orderRef: string;
  paidDate: string | null;
  settled: number | null;
  subtotal: number | null;
  /** Absolute value of column O. */
  fee: number;
};

const COL = { order: 0, paid: 3, settled: 5, subtotal: 7, fee: 14 } as const;

export function parsePaidDate(raw: unknown): string | null {
  const m = String(raw ?? "").trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!m) return null;
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${m[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Skips header/summary rows: only rows whose first cell looks like an order id are data. */
export function parseSettlementRows(grid: unknown[][]): SettlementRow[] {
  const rows: SettlementRow[] = [];
  for (const cells of grid) {
    const orderRef = String(cells[COL.order] ?? "").trim();
    if (!/^\d{10,}$/.test(orderRef)) continue;
    const fee = parseMoney(cells[COL.fee]);
    rows.push({
      orderRef,
      paidDate: parsePaidDate(cells[COL.paid]),
      settled: parseMoney(cells[COL.settled]),
      subtotal: parseMoney(cells[COL.subtotal]),
      fee: fee === null ? 0 : Math.abs(fee),
    });
  }
  return rows;
}

/** Splits an order's fee over its product rows by gross; the rounding remainder goes to the largest row. */
export function allocateFee(fee: number, grosses: number[]): number[] {
  const total = grosses.reduce((s, g) => s + g, 0);
  if (grosses.length === 0) return [];
  if (total <= 0) return grosses.map((_, i) => (i === 0 ? fee : 0));
  const parts = grosses.map((g) => Math.floor((fee * g) / total));
  const remainder = fee - parts.reduce((s, p) => s + p, 0);
  const largest = grosses.indexOf(Math.max(...grosses));
  parts[largest] += remainder;
  return parts;
}
