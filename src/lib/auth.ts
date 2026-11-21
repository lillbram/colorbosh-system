import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "admin";

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getCurrentRole(): Promise<Role | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const [row] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  return row?.role ?? null;
}

/**
 * Server-side role gate for pages and Server Actions. The app talks to
 * Postgres directly (Drizzle), so RLS does not apply — this check is the
 * only thing keeping admins out of owner-only data. Redirects to "/" on
 * failure; wrap `getCurrentRole()` yourself if an action needs to return
 * `{ error }` instead.
 */
export async function requireRole(role: Role): Promise<void> {
  const current = await getCurrentRole();
  if (current !== role) redirect(current ? "/" : "/login");
}
