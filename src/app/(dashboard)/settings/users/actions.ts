"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { withAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createUserSchema } from "@/lib/validators/auth";

export async function createUserByOwner(formData: FormData) {
  const actorId = await getCurrentUserId();
  if (!actorId) {
    return { error: "Sesi tidak valid, silakan masuk ulang" };
  }

  const [actor] = await db.select({ role: users.role }).from(users).where(eq(users.id, actorId));
  if (actor?.role !== "owner") {
    return { error: "Hanya Owner yang bisa menambah pengguna" };
  }

  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  }

  const admin = createAdminClient();
  const { data, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });

  if (createError || !data.user) {
    return { error: createError?.message ?? "Gagal membuat akun" };
  }

  try {
    await withAudit(
      { entityType: "user", entityId: data.user.id, action: "create", actorId },
      async (tx) => {
        await tx.insert(users).values({
          id: data.user.id,
          email: parsed.data.email,
          name: parsed.data.name,
          role: parsed.data.role,
          isActive: true,
        });
      }
    );
  } catch {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: "Gagal menyimpan data pengguna" };
  }

  revalidatePath("/settings/users");
  return { success: true };
}

export async function toggleUserActive(userId: string, isActive: boolean) {
  const actorId = await getCurrentUserId();
  if (!actorId) {
    return { error: "Sesi tidak valid, silakan masuk ulang" };
  }

  const [actor] = await db.select({ role: users.role }).from(users).where(eq(users.id, actorId));
  if (actor?.role !== "owner") {
    return { error: "Hanya Owner yang bisa mengubah status pengguna" };
  }

  try {
    await withAudit(
      { entityType: "user", entityId: userId, action: "update", actorId },
      async (tx) => {
        await tx.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId));
      }
    );
  } catch {
    return { error: "Gagal mengubah status pengguna" };
  }

  revalidatePath("/settings/users");
  return { success: true };
}
