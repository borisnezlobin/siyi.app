import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { normalizeReferralCode } from "@/lib/referral";
import {
  REFERRAL_COOKIE,
  REFERRAL_COOKIE_MAX_AGE,
} from "@/lib/referral-cookie";
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

/**
 * Remember a referral code from a `?ref=` link.
 *
 * Only captured, never spent: the signup paths do the crediting, because this
 * runs on every request and a database write here would be one per page view.
 * The cookie is not set for someone who already carries one — the first link a
 * person clicked is the one that brought them.
 */
function captureReferral(request: NextRequest, response: NextResponse) {
  const code = normalizeReferralCode(request.nextUrl.searchParams.get("ref"));
  if (!code || request.cookies.get(REFERRAL_COOKIE)) return;

  response.cookies.set(REFERRAL_COOKIE, code, {
    maxAge: REFERRAL_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
  });
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

  // Last, so it survives the reassignment `setAll` performs on `response`.
  captureReferral(request, response);

  return response;
}

/**
 * Every matched request pays a `supabase.auth.getUser()`, which is a call to
 * the auth server rather than a read of the cookie. The three things this
 * middleware does — refresh the session, hide /admin, remember a `?ref=` — are
 * all about a person looking at a page, so the files a browser fetches
 * alongside one are excluded: the worker it re-checks on every navigation, the
 * manifest, the offline page, and the files crawlers ask for. None of them is
 * auth-gated, none is a referral destination, and each was costing a round trip.
 *
 * `/api` stays in. Handlers authenticate themselves, so this is not what guards
 * them, but it is what keeps a long-lived session's cookie rotating, and taking
 * that away is a bigger change than it looks.
 */
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|sw\\.js|offline|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|\\.well-known|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
