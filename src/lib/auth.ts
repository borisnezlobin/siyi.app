import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Deduplicated for the length of one request.
 *
 * `auth.getUser()` is a call to the Supabase auth server, not a read of the
 * cookie, and a single page render asks several times over: the layout, the
 * page's own data helpers, and any route handler underneath. Each of those was
 * its own round trip on the critical path before anything could be shown.
 * React's `cache` collapses them into the first one; it is per-request, so a
 * signed-out session is never remembered into the next.
 */
async function loadAuthenticatedUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createClient();

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch (error) {
    /**
     * One retry, then treat it as signed out.
     *
     * The failure worth surviving is a token Supabase has just issued and does
     * not yet accept — `JWT issued at future`, the issuing clock a moment ahead
     * of the validating one. It resolves on its own in about a second, and it
     * only happens on a refresh, which only happens to somebody who has been
     * away a while. Throwing put an error screen in front of exactly that
     * person; waiting a moment gets them their app.
     *
     * If it fails twice it is not a clock, and `null` sends them to sign in —
     * which is a thing they can act on, unlike "Something went wrong."
     */
    console.error("[siyi] could not read the session, retrying", error);
    await new Promise((resolve) => setTimeout(resolve, 700));
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    } catch (secondError) {
      console.error("[siyi] could not read the session", secondError);
      return null;
    }
  }
}

export const getAuthenticatedUser = cache(loadAuthenticatedUser);

export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  return user;
}
