"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { accounts } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { accountSchema } from "@/lib/validators/account";

function toDbValues(data: ReturnType<typeof accountSchema.parse>) {
  return {
    name: data.name,
    type: data.type,
    openingBalance: String(data.openingBalance),
    isActive: data.isActive,
  };
}

export async function createAccount(formData: FormData) {
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();
  let newId = "";

  try {
    await withAudit(
      { entityType: "account", entityId: () => newId, action: "create", actorId },
      async (tx) => {
        const [inserted] = await tx
          .insert(accounts)
          .values(toDbValues(parsed.data))
          .returning();
        newId = inserted.id;
      }
    );
  } catch {
    return { error: "Gagal menyimpan akun" };
  }

  revalidatePath("/settings/accounts");
  return { success: true };
}

export async function updateAccount(id: string, formData: FormData) {
  const parsed = accountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const actorId = await getCurrentUserId();

  try {
    await withAudit(
      { entityType: "account", entityId: id, action: "update", actorId },
      async (tx) => {
        await tx.update(accounts).set(toDbValues(parsed.data)).where(eq(accounts.id, id));
      }
    );
  } catch {
    return { error: "Gagal memperbarui akun" };
  }

  revalidatePath("/settings/accounts");
  return { success: true };
}
