"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { suppliers } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { supplierSchema } from "@/lib/validators/supplier";

export async function createSupplier(formData: FormData) {
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  let newId = "";

  try {
    await withAudit(
      { entityType: "supplier", entityId: () => newId, action: "create", actorId },
      async (tx) => {
        const [inserted] = await tx
          .insert(suppliers)
          .values({ ...parsed.data, createdBy: actorId })
          .returning();
        newId = inserted.id;
      }
    );
  } catch {
    return { error: "Gagal menyimpan supplier" };
  }

  revalidatePath("/settings/suppliers");
  return { success: true };
}

export async function updateSupplier(id: string, formData: FormData) {
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "supplier", entityId: id, action: "update", actorId },
      async (tx) => {
        await tx
          .update(suppliers)
          .set({ ...parsed.data, updatedAt: new Date() })
          .where(eq(suppliers.id, id));
      }
    );
  } catch {
    return { error: "Gagal memperbarui supplier" };
  }

  revalidatePath("/settings/suppliers");
  return { success: true };
}

export async function deleteSupplier(id: string) {
  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "supplier", entityId: id, action: "delete", actorId },
      async (tx) => {
        await tx.update(suppliers).set({ isDeleted: true }).where(eq(suppliers.id, id));
      }
    );
  } catch {
    return { error: "Gagal menghapus supplier" };
  }

  revalidatePath("/settings/suppliers");
  return { success: true };
}
