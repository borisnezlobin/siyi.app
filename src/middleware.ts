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

  /**
   * Never allowed to throw.
   *
   * This ran on every signed-in request, and an unhandled rejection here is a
   * 500 on whatever the reader was opening — the whole app, not one screen.
   * Production caught it doing exactly that: `Error: JWT issued at future` on
   * `GET /today`, which is Supabase refusing a token it had just minted because
   * the issuing clock was a moment ahead of the validating one. That only
   * happens when a token is refreshed, and a token is only refreshed after the
   * old one has expired — so it lands on somebody opening the app after hours
   * away, which is the worst possible moment to show them a broken screen.
   *
   * There is nothing here worth failing a request over. Refreshing the cookie
   * is a courtesy, and hiding /admin degrades safely: `requireAdminPageUser()`
   * is the actual authorisation and runs regardless. So a bad answer means
   * "carry on without a user" — the page's own `getAuthenticatedUser()` decides
   * what an absent session means, and it can send them to sign in, which is a
   * far better outcome than an error screen.
   */
  let user: User | null = null;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (error) {
    console.error("[siyi] middleware could not read the session", error);
  }

  // The page still calls requireAdminPageUser(): this is the status code, not
  // the authorisation, and the page must not depend on middleware having run.
  if (isAdminPath(request.nextUrl.pathname) && !isAdminUser(toAdminIdentity(user))) {
    return unknownRoute(request);
  }

  return response;
}

/**
 * Every matched request pays a `supabase.auth.getUser()`, which is a call to
 * the auth server rather than a read of the cookie. What this middleware does —
 * refresh the session and hide /admin — is about a person looking at a page, so
 * the files a browser fetches alongside one are excluded: the worker it
 * re-checks on every navigation, the manifest, the offline page, and the files
 * crawlers ask for. None is auth-gated, and each was costing a round trip.
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
