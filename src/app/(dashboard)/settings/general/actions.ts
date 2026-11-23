"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { settings } from "@/db/schema";
import { getCurrentUserId, requireRole } from "@/lib/auth";
import { withAudit } from "@/lib/audit";

const schema = z.object({
  salaryPct: z.coerce.number().min(0, "Persen gaji minimal 0").max(100, "Persen gaji maksimal 100"),
  returnReservePct: z.coerce.number().min(0).max(100),
  capitalReservePct: z.coerce.number().min(0).max(100),
  lowStockThreshold: z.coerce.number().int("Batas stok harus bilangan bulat").min(0).max(100000),
});

export async function saveGeneralSettings(formData: FormData) {
  await requireRole("owner");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const d = parsed.data;
  const actorId = await getCurrentUserId();

  try {
    await withAudit({ entityType: "settings", entityId: actorId ?? "00000000-0000-0000-0000-000000000000", action: "update", actorId, diff: d }, async (tx) => {
      await tx
        .update(settings)
        .set({
          // Stored as a fraction (1.00 = 100%), shown to the user as a percent.
          salaryPct: String(d.salaryPct / 100),
          returnReservePct: String(d.returnReservePct),
          capitalReservePct: String(d.capitalReservePct),
          lowStockThreshold: d.lowStockThreshold,
          updatedAt: new Date(),
        })
        .where(eq(settings.id, 1));
    });
  } catch {
    return { error: "Gagal menyimpan pengaturan" };
  }
  revalidatePath("/settings/general");
  revalidatePath("/salary");
  revalidatePath("/stock");
  return { success: true };
}
