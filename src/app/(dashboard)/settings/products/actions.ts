"use server";

import { requireRole } from "@/lib/auth";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  products,
  productAliases,
  salesEntries,
  salesReturns,
  stockMovements,
} from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { productSchema } from "@/lib/validators/product";

function toDbValues(data: ReturnType<typeof productSchema.parse>) {
  return {
    name: data.name,
    sku: data.sku?.trim() || null,
    category: data.category || null,
    basePrice: data.basePrice !== undefined ? String(data.basePrice) : null,
    hppTarget: data.hppTarget !== undefined ? String(data.hppTarget) : null,
    isActive: data.isActive,
  };
}

export async function createProduct(formData: FormData) {
  await requireRole("owner");
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
  await requireRole("owner");
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
  await requireRole("owner");
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

/**
 * Merge product B (`sourceId`) into A (`targetId`): sales, stock movements and
 * returns are re-pointed to A, B's name (and aliases) become aliases of A, and
 * B is soft-deleted. Stops without changes if re-pointing would collide with an
 * existing (channel, order, product) sales row.
 */
export async function mergeProducts(sourceId: string, targetId: string) {
  await requireRole("owner");
  if (sourceId === targetId) return { error: "Pilih produk tujuan yang berbeda" };
  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "product", entityId: sourceId, action: "update", actorId },
      async (tx) => {
        const found = await tx
          .select({ id: products.id, name: products.name, isDeleted: products.isDeleted })
          .from(products)
          .where(inArray(products.id, [sourceId, targetId]));
        const source = found.find((p) => p.id === sourceId);
        const target = found.find((p) => p.id === targetId);
        if (!source || !target) throw new Error("Produk tidak ditemukan");
        if (target.isDeleted) throw new Error("Produk tujuan sudah dihapus");

        const sourceRows = await tx
          .select({ channelId: salesEntries.channelId, orderRef: salesEntries.orderRef })
          .from(salesEntries)
          .where(and(eq(salesEntries.productId, sourceId), isNotNull(salesEntries.orderRef)));
        if (sourceRows.length > 0) {
          const targetRows = await tx
            .select({ channelId: salesEntries.channelId, orderRef: salesEntries.orderRef })
            .from(salesEntries)
            .where(and(eq(salesEntries.productId, targetId), isNotNull(salesEntries.orderRef)));
          const taken = new Set(targetRows.map((r) => `${r.channelId}|${r.orderRef}`));
          const clash = sourceRows.find((r) => taken.has(`${r.channelId}|${r.orderRef}`));
          if (clash) {
            throw new Error(
              `Tidak bisa digabung: order ${clash.orderRef} sudah ada untuk kedua produk di channel yang sama`
            );
          }
        }

        await tx.update(salesEntries).set({ productId: targetId }).where(eq(salesEntries.productId, sourceId));
        await tx.update(salesReturns).set({ productId: targetId }).where(eq(salesReturns.productId, sourceId));
        await tx.update(stockMovements).set({ productId: targetId }).where(eq(stockMovements.productId, sourceId));
        await tx.update(productAliases).set({ productId: targetId }).where(eq(productAliases.productId, sourceId));
        await tx
          .insert(productAliases)
          .values({ productId: targetId, alias: source.name })
          .onConflictDoNothing();
        await tx
          .update(products)
          .set({ isDeleted: true, isActive: false, sku: null, updatedAt: new Date() })
          .where(eq(products.id, sourceId));
      }
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Gagal menggabungkan produk" };
  }

  revalidatePath("/settings/products");
  revalidatePath("/sales");
  revalidatePath("/stock");
  return { success: true };
}
