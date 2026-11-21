/**
 * Signed "app unlocked" cookie for the PIN screen lock. Uses Web Crypto so it
 * works in proxy.ts and in Server Actions alike. Disabled (returns null /
 * false) when no secret is configured.
 */
export const UNLOCK_COOKIE = "cb_unlock";
export const PIN_FLAG_COOKIE = "cb_pin";
export const LOCK_IDLE_MS = 5 * 60 * 1000;

function secret(): string | null {
  return process.env.LOCK_SECRET || process.env.CRON_SECRET || null;
}

export function lockEnabled(): boolean {
  return secret() !== null;
}

async function hmac(message: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signUnlock(userId: string, now = Date.now()): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const expires = now + LOCK_IDLE_MS;
  return `${expires}.${await hmac(`${userId}.${expires}`, key)}`;
}

export async function verifyUnlock(value: string | undefined, userId: string, now = Date.now()): Promise<boolean> {
  const key = secret();
  if (!key || !value) return false;
  const [expires, sig] = value.split(".");
  if (!expires || !sig || Number(expires) < now) return false;
  const expected = await hmac(`${userId}.${expires}`, key);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export const lockCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: LOCK_IDLE_MS / 1000,
};
