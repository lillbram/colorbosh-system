"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userPins } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { lockCookieOptions, PIN_FLAG_COOKIE, signUnlock, UNLOCK_COOKIE } from "@/lib/lock-cookie";
import { MAX_PIN_ATTEMPTS, PIN_REGEX, verifyPinHash } from "@/lib/pin";
import { logoutAction } from "@/lib/session-actions";

const LOCKOUT_MS = 15 * 60 * 1000;

export async function unlockAction(formData: FormData) {
  const pin = String(formData.get("pin") ?? "");
  const next = String(formData.get("next") ?? "/");
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");
  if (!PIN_REGEX.test(pin)) return { error: "PIN harus 6 angka" };

  const [row] = await db.select().from(userPins).where(eq(userPins.userId, userId));
  const store = await cookies();
  if (!row) {
    // PIN was removed elsewhere — nothing to unlock.
    store.delete(PIN_FLAG_COOKIE);
    redirect(next.startsWith("/") ? next : "/");
  }

  if (row.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
    return { error: "Terlalu banyak percobaan. Masuk lagi dengan email dan password." };
  }

  if (!(await verifyPinHash(pin, row.pinHash))) {
    const attempts = row.failedAttempts + 1;
    const lock = attempts >= MAX_PIN_ATTEMPTS;
    await db
      .update(userPins)
      .set({
        failedAttempts: lock ? 0 : attempts,
        lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MS) : null,
      })
      .where(eq(userPins.userId, userId));
    // Too many tries: drop the session so only email + password gets back in.
    if (lock) await logoutAction();
    return { error: `PIN salah. Sisa percobaan: ${MAX_PIN_ATTEMPTS - attempts}` };
  }

  await db.update(userPins).set({ failedAttempts: 0, lockedUntil: null }).where(eq(userPins.userId, userId));
  const signed = await signUnlock(userId);
  if (signed) store.set(UNLOCK_COOKIE, signed, lockCookieOptions);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}
