import type { Session } from "@supabase/supabase-js";

/**
 * A handful of things the phone cannot do against Supabase directly — account
 * export, announcements, the admin console — are served by the Next app, which
 * holds the service role. They all authenticate the same way: the Supabase
 * session's access token, which the web verifies before doing anything.
 */
export function requireWebUrl(webUrl: string) {
  if (!webUrl) {
    throw new Error("Set the production web URL before using this feature.");
  }
  return webUrl.replace(/\/$/, "");
}

export async function authenticatedWebRequest(
  session: Session,
  webUrl: string,
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`${requireWebUrl(webUrl)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? ((await response.json().catch(() => null)) as
          | { error?: string }
          | null)
      : null;
    throw new Error(
      payload?.error ||
        `The server returned ${response.status}. Please try again.`,
    );
  }
  return response;
}
