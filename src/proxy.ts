import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  lockCookieOptions,
  lockEnabled,
  PIN_FLAG_COOKIE,
  signUnlock,
  UNLOCK_COOKIE,
  verifyUnlock,
} from "@/lib/lock-cookie";

const REMEMBER_MAX_AGE = 60 * 60 * 24 * 30; // "Ingat perangkat ini": 30 days

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Login without "Ingat perangkat ini" → auth cookies stay session-only.
  const sessionOnly = request.cookies.get("cb_session_only")?.value === "1";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              maxAge: sessionOnly ? undefined : options.maxAge === 0 ? 0 : REMEMBER_MAX_AGE,
              expires: sessionOnly ? undefined : options.expires,
            })
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/signup");
  const isUnlockRoute = path.startsWith("/unlock");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // PIN screen lock: only for devices that set a PIN (flag cookie) and only
  // when a secret is configured. The signed cookie slides forward on activity.
  if (user && lockEnabled() && request.cookies.get(PIN_FLAG_COOKIE)?.value === "1") {
    const unlocked = await verifyUnlock(request.cookies.get(UNLOCK_COOKIE)?.value, user.id);
    if (!unlocked && !isUnlockRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/unlock";
      url.search = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
      return NextResponse.redirect(url);
    }
    if (unlocked) {
      const signed = await signUnlock(user.id);
      if (signed) response.cookies.set(UNLOCK_COOKIE, signed, lockCookieOptions);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
