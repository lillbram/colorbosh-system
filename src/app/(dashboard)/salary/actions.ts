"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { monthClosings } from "@/db/schema";
import { getCurrentUserId, requireRole } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { getPnL, getSalaryOverview, getWorkingCapital } from "@/lib/finance";
import { monthRange, todayJakarta } from "@/lib/period";

/** Tutup Buku: freezes the month's numbers; later edits in it are owner-only and audited (month-lock.ts). */
export async function closeMonth(month: string) {
  await requireRole("owner");
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: "Bulan tidak valid" };
  const actorId = await getCurrentUserId();
  const range = monthRange(month);

  try {
    const [pnl, salary, capital] = await Promise.all([
      getPnL(range.start, range.end),
      getSalaryOverview(),
      getWorkingCapital(range.end > todayJakarta() ? todayJakarta() : range.end),
    ]);
    const row = salary.months.find((m) => m.month === month) ?? null;
    const snapshot = {
      month,
      closedAt: new Date().toISOString(),
      pnl,
      salary: row,
      salaryPct: salary.pct,
      salaryPayments: salary.payments.filter((p) => p.periodMonth === month),
      capital,
    };
    let newId = "";
    await withAudit({ entityType: "month_closing", entityId: () => newId, action: "create", actorId }, async (tx) => {
      const [inserted] = await tx
        .insert(monthClosings)
        .values({ month, snapshot, closedBy: actorId })
        .returning({ id: monthClosings.id });
      newId = inserted.id;
    });
  } catch {
    return { error: "Gagal menutup bulan (mungkin sudah ditutup)" };
  }
  revalidatePath("/salary");
  return { success: true };
}

export async function reopenMonth(month: string) {
  await requireRole("owner");
  const actorId = await getCurrentUserId();
  try {
    const [row] = await db.select({ id: monthClosings.id }).from(monthClosings).where(eq(monthClosings.month, month));
    if (!row) return { error: "Bulan ini tidak dikunci" };
    await withAudit({ entityType: "month_closing", entityId: row.id, action: "delete", actorId, diff: { month } }, async (tx) => {
      await tx.delete(monthClosings).where(eq(monthClosings.id, row.id));
    });
  } catch {
    return { error: "Gagal membuka kunci" };
  }
  revalidatePath("/salary");
  return { success: true };
}
