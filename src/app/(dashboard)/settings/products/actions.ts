"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { products } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { productSchema } from "@/lib/validators/product";

function toDbValues(data: ReturnType<typeof productSchema.parse>) {
  return {
    name: data.name,
    sku: data.sku || null,
    category: data.category || null,
    basePrice: data.basePrice !== undefined ? String(data.basePrice) : null,
    hppTarget: data.hppTarget !== undefined ? String(data.hppTarget) : null,
    isActive: data.isActive,
  };
}

export async function createProduct(formData: FormData) {
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  let newId = "";

  try {
    await withAudit(
      { entityType: "product", entityId: () => newId, action: "create", actorId },
      async (tx) => {
        const [inserted] = await tx
          .insert(products)
          .values({ ...toDbValues(parsed.data), createdBy: actorId })
          .returning();
        newId = inserted.id;
      }
    );
  } catch {
    return { error: "Gagal menyimpan produk (SKU mungkin sudah dipakai)" };
  }

  revalidatePath("/settings/products");
  return { success: true };
}

export async function updateProduct(id: string, formData: FormData) {
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "product", entityId: id, action: "update", actorId },
      async (tx) => {
        await tx
          .update(products)
          .set({ ...toDbValues(parsed.data), updatedAt: new Date() })
          .where(eq(products.id, id));
      }
    );
  } catch {
    return { error: "Gagal memperbarui produk" };
  }

  revalidatePath("/settings/products");
  return { success: true };
}

export async function deleteProduct(id: string) {
  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "product", entityId: id, action: "delete", actorId },
      async (tx) => {
        await tx.update(products).set({ isDeleted: true }).where(eq(products.id, id));
      }
    );
  } catch {
    return { error: "Gagal menghapus produk" };
  }

  revalidatePath("/settings/products");
  return { success: true };
}
