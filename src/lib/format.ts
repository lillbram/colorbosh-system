import { format } from "date-fns";
import { id } from "date-fns/locale";

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date | string): string {
  return format(new Date(date), "dd/MM/yyyy", { locale: id });
}

export function formatDateLong(date: Date | string): string {
  return format(new Date(date), "d MMMM yyyy", { locale: id });
}

export function parseNumberInput(v: string): number {
  return Number(v.replace(/[^\d]/g, ""));
}

/** "Terakhir dicatat: 12 Agu" style note; `stale` once older than `maxDays`. */
export function lastRecordedNote(
  lastDate: string | null,
  today: string,
  maxDays = 7
): { text: string; warn: boolean } {
  if (!lastDate) return { text: "Belum ada transaksi kas dicatat", warn: true };
  const days = Math.floor((Date.parse(today) - Date.parse(lastDate)) / 86_400_000);
  return {
    text: `Terakhir dicatat: ${format(new Date(lastDate), "d MMM", { locale: id })}`,
    warn: days > maxDays,
  };
}
