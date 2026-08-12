"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { productionCostComponents } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { costComponentSchema } from "@/lib/validators/cost-component";

function toDbValues(data: ReturnType<typeof costComponentSchema.parse>) {
  return {
    name: data.name,
    category: data.category,
    unit: data.unit,
    unitCost: String(data.unitCost),
    notes: data.notes || null,
    isActive: data.isActive,
  };
}

export async function createCostComponent(formData: FormData) {
  const parsed = costComponentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  let newId = "";

  try {
    await withAudit(
      { entityType: "production_cost_component", entityId: () => newId, action: "create", actorId },
      async (tx) => {
        const [inserted] = await tx
          .insert(productionCostComponents)
          .values({ ...toDbValues(parsed.data), createdBy: actorId })
          .returning();
        newId = inserted.id;
      }
    );
  } catch {
    return { error: "Gagal menyimpan komponen biaya" };
  }

  revalidatePath("/settings/cost-components");
  return { success: true };
}

export async function updateCostComponent(id: string, formData: FormData) {
  const parsed = costComponentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "production_cost_component", entityId: id, action: "update", actorId },
      async (tx) => {
        await tx
          .update(productionCostComponents)
          .set({ ...toDbValues(parsed.data), updatedAt: new Date() })
          .where(eq(productionCostComponents.id, id));
      }
    );
  } catch {
    return { error: "Gagal memperbarui komponen biaya" };
  }

  revalidatePath("/settings/cost-components");
  return { success: true };
}

export async function deleteCostComponent(id: string) {
  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "production_cost_component", entityId: id, action: "delete", actorId },
      async (tx) => {
        await tx
          .update(productionCostComponents)
          .set({ isDeleted: true })
          .where(eq(productionCostComponents.id, id));
      }
    );
  } catch {
    return { error: "Gagal menghapus komponen biaya" };
  }

  revalidatePath("/settings/cost-components");
  return { success: true };
}
