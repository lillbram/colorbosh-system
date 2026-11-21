"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PIN_FLAG_COOKIE, UNLOCK_COOKIE } from "@/lib/lock-cookie";

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const store = await cookies();
  store.delete(UNLOCK_COOKIE);
  store.delete(PIN_FLAG_COOKIE);
  store.delete("cb_session_only");
  redirect("/login");
}
