"use server";

import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/validators/auth";

export async function signupAction(formData: FormData) {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    return { error: "Pendaftaran sudah ditutup. Hubungi owner untuk diundang." };
  }

  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
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
    await db.insert(users).values({
      id: data.user.id,
      email: parsed.data.email,
      name: parsed.data.name,
      role: "owner",
      isActive: true,
    });
  } catch {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: "Gagal menyimpan data pengguna" };
  }

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  redirect("/");
}
