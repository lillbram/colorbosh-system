import { addMonths, endOfMonth, format, parseISO, startOfMonth, subMonths } from "date-fns";
import { id } from "date-fns/locale";

const YMD = "yyyy-MM-dd";

/** Today's date in Asia/Jakarta as yyyy-MM-dd — server runs in UTC on Vercel, so `new Date()` is a day behind from 00:00–07:00 WIB. */
export function todayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

export function isValidMonth(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function monthRange(month: string): { start: string; end: string } {
  const d = parseISO(`${month}-01`);
  return { start: format(startOfMonth(d), YMD), end: format(endOfMonth(d), YMD) };
}

export function monthLabel(month: string): string {
  return format(parseISO(`${month}-01`), "MMMM yyyy", { locale: id });
}

/** Last `count` months (newest first), starting from the current month in Jakarta. */
export function recentMonths(count = 18): { value: string; label: string }[] {
  const current = parseISO(`${todayJakarta().slice(0, 7)}-01`);
  return Array.from({ length: count }, (_, i) => {
    const value = format(subMonths(current, i), "yyyy-MM");
    return { value, label: monthLabel(value) };
  });
}

/**
 * Month-to-date range for `month` (default: current Jakarta month). A past
 * month is the whole month; the current month stops at today so comparisons
 * against the previous month cover the same number of days.
 */
export function monthToDate(month?: string): { start: string; end: string; month: string } {
  const today = todayJakarta();
  const m = isValidMonth(month) ? month : today.slice(0, 7);
  const { start, end } = monthRange(m);
  return { start, end: end > today ? today : end, month: m };
}

/**
 * Comparison period for [start, end]: the same day-range one month earlier
 * (1–21 Nov vs 1–21 Okt). A full calendar month compares to the full month
 * before it.
 */
export function previousPeriod(start: string, end: string): { start: string; end: string } {
  const s = parseISO(start);
  const e = parseISO(end);
  const isFullMonth =
    format(s, YMD) === format(startOfMonth(s), YMD) && format(e, YMD) === format(endOfMonth(s), YMD);
  if (isFullMonth) return monthRange(format(subMonths(s, 1), "yyyy-MM"));
  return { start: format(subMonths(s, 1), YMD), end: format(subMonths(e, 1), YMD) };
}

export function nextMonth(month: string): string {
  return format(addMonths(parseISO(`${month}-01`), 1), "yyyy-MM");
}
