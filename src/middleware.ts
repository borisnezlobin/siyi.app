import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import {
  getSupabasePublicConfig,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * A page cannot set its own status code, so `notFound()` inside /admin renders
 * the not-found screen but still answers 200 — while a genuinely unknown URL
 * answers 404. That difference is enough to tell a scanner the route exists,
 * which is the one thing the admin routes are supposed to hide. Rewriting to
 * an unrouted path here produces the same 404, from the same not-found page,
 * that any made-up URL produces.
 */
function unknownRoute(request: NextRequest) {
  return NextResponse.rewrite(
    new URL("/_siyi-no-such-route", request.url),
    { status: 404 },
  );
}

function toAdminIdentity(user: User | null | undefined) {
  return user
    ? {
        id: user.id,
        email: user.email,
        emailConfirmedAt: user.email_confirmed_at,
      }
    : null;
}

export async function middleware(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    // With no auth configured nobody can be an admin, so the route has to be
    // as invisible as it is in production.
    return isAdminPath(request.nextUrl.pathname)
      ? unknownRoute(request)
      : NextResponse.next();
  }

  const { url, publishableKey } = getSupabasePublicConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The page still calls requireAdminPageUser(): this is the status code, not
  // the authorisation, and the page must not depend on middleware having run.
  if (isAdminPath(request.nextUrl.pathname) && !isAdminUser(toAdminIdentity(user))) {
    return unknownRoute(request);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
