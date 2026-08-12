"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { categories } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { categorySchema } from "@/lib/validators/category";

export async function createCategory(formData: FormData) {
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  let newId = "";

  try {
    await withAudit(
      { entityType: "category", entityId: () => newId, action: "create", actorId },
      async (tx) => {
        const [inserted] = await tx.insert(categories).values(parsed.data).returning();
        newId = inserted.id;
      }
    );
  } catch {
    return { error: "Gagal menyimpan kategori" };
  }

  revalidatePath("/settings/categories");
  return { success: true };
}

export async function deleteCategory(id: string) {
  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "category", entityId: id, action: "delete", actorId },
      async (tx) => {
        await tx.delete(categories).where(eq(categories.id, id));
      }
    );
  } catch {
    return { error: "Gagal menghapus kategori" };
  }

  revalidatePath("/settings/categories");
  return { success: true };
}
