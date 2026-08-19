import type { Session } from "@supabase/supabase-js";
import { authenticatedWebRequest } from "@/lib/web-api";

/**
 * The phone talks to Amelia only through the web app's /api/amelia routes —
 * the phone never holds AMELIA_API_URL. Shapes mirror the overview route's
 * response.
 */
export type AmeliaOverview = {
  configured: boolean;
  reachable?: boolean;
  link?: { ameliaPersonId: string } | null;
  people?: { id: string; name: string; linked: boolean }[];
  conversations?: {
    id: string;
    title: string | null;
    startedAt: string;
    participants: string[];
    imported: boolean;
  }[];
};

/**
 * Null means "no Amelia here" — web URL unset, endpoint missing, network gone.
 * The card treats all of those as reason to not exist, same as the web.
 */
export async function fetchAmeliaOverview(
  session: Session,
  webUrl: string,
  personId: string,
): Promise<AmeliaOverview | null> {
  if (!webUrl) return null;
  try {
    const response = await authenticatedWebRequest(
      session,
      webUrl,
      `/api/amelia/overview?personId=${encodeURIComponent(personId)}`,
    );
    return (await response.json()) as AmeliaOverview;
  } catch {
    return null;
  }
}

export async function linkAmeliaSpeaker(
  session: Session,
  webUrl: string,
  personId: string,
  ameliaPersonId: string,
): Promise<void> {
  await authenticatedWebRequest(session, webUrl, "/api/amelia/links", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ personId, ameliaPersonId }),
  });
}

export async function unlinkAmeliaSpeaker(
  session: Session,
  webUrl: string,
  personId: string,
): Promise<void> {
  await authenticatedWebRequest(session, webUrl, "/api/amelia/links", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ personId }),
  });
}

export async function importAmeliaConversation(
  session: Session,
  webUrl: string,
  conversationId: string,
): Promise<void> {
  await authenticatedWebRequest(
    session,
    webUrl,
    "/api/amelia/conversations/import",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId }),
    },
  );
}
