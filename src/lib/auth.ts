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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export const getAuthenticatedUser = cache(loadAuthenticatedUser);

export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getAuthenticatedUser();

  if (!user) {
    throw new Error("Authentication required");
  }

  return user;
}
