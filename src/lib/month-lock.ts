import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { monthClosings } from "@/db/schema";
import { getCurrentRole, getCurrentUserId } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { monthLabel } from "@/lib/period";

/**
 * "Tutup Buku" guard. Call before a write that touches `dates`. Returns an
 * error message when a locked month would be edited by a non-owner; when the
 * owner edits a locked month it passes but leaves an audit entry naming what
 * changed (CLAUDE.md §6.9).
 */
export async function lockedMonthError(
  dates: (string | null | undefined)[],
  what: string
): Promise<string | null> {
  const months = [...new Set(dates.filter((d): d is string => !!d && /^\d{4}-\d{2}/.test(d)).map((d) => d.slice(0, 7)))];
  if (months.length === 0) return null;

  const locked = await db
    .select({ id: monthClosings.id, month: monthClosings.month })
    .from(monthClosings)
    .where(inArray(monthClosings.month, months));
  if (locked.length === 0) return null;

  if ((await getCurrentRole()) !== "owner") {
    return `Bulan ${locked.map((l) => monthLabel(l.month)).join(", ")} sudah ditutup. Hanya Owner yang bisa mengubahnya.`;
  }
  const actorId = await getCurrentUserId();
  for (const l of locked) {
    await writeAuditLog(db, {
      entityType: "month_closing",
      entityId: l.id,
      action: "update",
      actorId,
      diff: { lockedMonthEdit: what, month: l.month },
    });
  }
  return null;
}
