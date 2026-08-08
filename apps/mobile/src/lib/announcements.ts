import type { Session } from "@supabase/supabase-js";
import { authenticatedWebRequest } from "@/lib/web-api";

export type BannerAnnouncement = {
  id: string;
  title: string;
  body: string;
};

/**
 * Announcements are optional furniture, exactly as they are on the web: if the
 * endpoint is unreachable, the table has not been migrated, or this account is
 * in no segment, this answers with nothing and no banner appears. It never
 * throws, because a failed banner is not worth an error state on the phone.
 */
export async function fetchLiveAnnouncements(
  session: Session,
  webUrl: string,
): Promise<BannerAnnouncement[]> {
  if (!webUrl) return [];
  try {
    const response = await authenticatedWebRequest(
      session,
      webUrl,
      "/api/announcements",
    );
    const payload = (await response.json()) as {
      announcements?: BannerAnnouncement[];
    };
    return payload.announcements ?? [];
  } catch {
    return [];
  }
}

/**
 * The dismissal is recorded server-side, so putting a phone away and opening
 * the web does not bring the same banner back.
 */
export async function dismissAnnouncement(
  session: Session,
  webUrl: string,
  announcementId: string,
): Promise<void> {
  if (!webUrl) return;
  try {
    await authenticatedWebRequest(
      session,
      webUrl,
      "/api/announcements/dismiss",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcementId }),
      },
    );
  } catch {
    // Dismissing again next time is a much smaller problem than a crash.
  }
}
