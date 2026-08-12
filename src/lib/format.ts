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
