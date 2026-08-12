"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { tailors } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { tailorSchema } from "@/lib/validators/tailor";

export async function createTailor(formData: FormData) {
  const parsed = tailorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  let newId = "";

  try {
    await withAudit(
      { entityType: "tailor", entityId: () => newId, action: "create", actorId },
      async (tx) => {
        const [inserted] = await tx
          .insert(tailors)
          .values({ ...parsed.data, createdBy: actorId })
          .returning();
        newId = inserted.id;
      }
    );
  } catch {
    return { error: "Gagal menyimpan penjahit" };
  }

  revalidatePath("/settings/tailors");
  return { success: true };
}

export async function updateTailor(id: string, formData: FormData) {
  const parsed = tailorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "tailor", entityId: id, action: "update", actorId },
      async (tx) => {
        await tx
          .update(tailors)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(eq(tailors.id, id));
      }
    );
  } catch {
    return { error: "Gagal memperbarui penjahit" };
  }

  revalidatePath("/settings/tailors");
  return { success: true };
}

export async function deleteTailor(id: string) {
  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "tailor", entityId: id, action: "delete", actorId },
      async (tx) => {
        await tx.update(tailors).set({ isDeleted: true }).where(eq(tailors.id, id));
      }
    );
  } catch {
    return { error: "Gagal menghapus penjahit" };
  }

  revalidatePath("/settings/tailors");
  return { success: true };
}
