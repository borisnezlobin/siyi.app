import type { Cookie } from "@playwright/test";

/**
 * The cookie @supabase/ssr reads a session out of. supabase-js derives the
 * name from the first label of the Supabase host, so a stub on 127.0.0.1 is
 * always `sb-127-auth-token`, and the value is the session JSON behind a
 * `base64-` marker.
 */
export function sessionCookie(
  user: unknown,
  { url, supabaseHost = "127.0.0.1" }: { url: string; supabaseHost?: string },
): Cookie & { url: string } {
  const session = {
    access_token: "stub-access-token",
    refresh_token: "stub-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };

  return {
    name: `sb-${supabaseHost.split(".")[0]}-auth-token`,
    value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`,
    url,
  } as Cookie & { url: string };
}
