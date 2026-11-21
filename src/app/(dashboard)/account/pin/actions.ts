"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userPins } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import {
  lockCookieOptions,
  lockEnabled,
  PIN_FLAG_COOKIE,
  signUnlock,
  UNLOCK_COOKIE,
} from "@/lib/lock-cookie";
import { hashPin, PIN_REGEX } from "@/lib/pin";

export async function setPin(formData: FormData) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Sesi tidak valid, silakan masuk ulang" };
  if (!lockEnabled()) return { error: "Kunci PIN belum aktif di server (LOCK_SECRET belum diatur)" };

  const pin = String(formData.get("pin") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (!PIN_REGEX.test(pin)) return { error: "PIN harus 6 angka" };
  if (pin !== confirm) return { error: "Konfirmasi PIN tidak sama" };

  const pinHash = await hashPin(pin);
  await db
    .insert(userPins)
    .values({ userId, pinHash })
    .onConflictDoUpdate({
      target: userPins.userId,
      set: { pinHash, failedAttempts: 0, lockedUntil: null, updatedAt: new Date() },
    });

  // Setting a PIN shouldn't lock the user out of the screen they're on.
  const store = await cookies();
  store.set(PIN_FLAG_COOKIE, "1", { ...lockCookieOptions, maxAge: 60 * 60 * 24 * 365 });
  const signed = await signUnlock(userId);
  if (signed) store.set(UNLOCK_COOKIE, signed, lockCookieOptions);

  revalidatePath("/account/pin");
  return { success: true };
}

export async function removePin() {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "Sesi tidak valid, silakan masuk ulang" };
  await db.delete(userPins).where(eq(userPins.userId, userId));
  const store = await cookies();
  store.delete(PIN_FLAG_COOKIE);
  store.delete(UNLOCK_COOKIE);
  revalidatePath("/account/pin");
  return { success: true };
}
