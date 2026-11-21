"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userPins } from "@/db/schema";
import { lockCookieOptions, lockEnabled, PIN_FLAG_COOKIE, signUnlock, UNLOCK_COOKIE } from "@/lib/lock-cookie";
import { createClient } from "@/lib/supabase/server";

const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30; // keep in sync with proxy.ts

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { error: "Email atau password salah." };
  }

  const store = await cookies();

  // "Ingat perangkat ini": 30-day auth cookies; unchecked → session-only
  // (proxy.ts keeps them session-only on refresh via the cb_session_only flag).
  for (const c of store.getAll().filter((c) => c.name.startsWith("sb-"))) {
    store.set(c.name, c.value, {
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: remember ? REMEMBER_MAX_AGE : undefined,
    });
  }
  if (remember) store.delete("cb_session_only");
  else store.set("cb_session_only", "1", { path: "/", httpOnly: true, sameSite: "lax" });

  // Entering the password counts as unlocking the PIN lock on this device.
  const [pin] = await db.select({ id: userPins.userId }).from(userPins).where(eq(userPins.userId, data.user.id));
  if (pin && lockEnabled()) {
    store.set(PIN_FLAG_COOKIE, "1", { ...lockCookieOptions, maxAge: 60 * 60 * 24 * 365 });
    const signed = await signUnlock(data.user.id);
    if (signed) store.set(UNLOCK_COOKIE, signed, lockCookieOptions);
  } else {
    store.delete(PIN_FLAG_COOKIE);
  }

  redirect("/");
}
