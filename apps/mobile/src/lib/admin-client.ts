import type { Session } from "@supabase/supabase-js";
import { authenticatedWebRequest } from "@/lib/web-api";

export type AdminStats = {
  totalUsers: number;
  totalContacts: number;
  newUsersLast7: number;
  newUsersLast30: number;
  signupsByWeek: { weekStarting: string; users: number }[];
  contactBuckets: { id: string; label: string; users: number }[];
  pushEnabledUsers: number;
  activeLast7: number;
  activeLast30: number;
};

export type AdminSegmentSummary = {
  id: string;
  label: string;
  description: string;
  users: number;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  segment: string;
  startsAt: string;
  endsAt: string | null;
  createdBy: string | null;
  createdAt: string;
  audienceSize: number | null;
  pushSentAt: string | null;
  pushRecipientCount: number | null;
  pushDeliveredCount: number | null;
  pushFailedCount: number | null;
};

/**
 * Every admin route answers 404 rather than 403, so a non-admin cannot learn
 * the route exists. That is why this returns null instead of throwing: the
 * screen shows the same "not found" a mistyped deep link would.
 */
export async function fetchAdminOverview(
  session: Session,
  webUrl: string,
): Promise<{ stats: AdminStats; segments: AdminSegmentSummary[] } | null> {
  try {
    const response = await authenticatedWebRequest(
      session,
      webUrl,
      "/api/admin/stats",
    );
    return (await response.json()) as {
      stats: AdminStats;
      segments: AdminSegmentSummary[];
    };
  } catch {
    return null;
  }
}

export async function fetchAdminAnnouncements(
  session: Session,
  webUrl: string,
): Promise<Announcement[]> {
  try {
    const response = await authenticatedWebRequest(
      session,
      webUrl,
      "/api/admin/announcements",
    );
    const payload = (await response.json()) as {
      announcements?: Announcement[];
    };
    return payload.announcements ?? [];
  } catch {
    return [];
  }
}

export type AnnouncementDraft = {
  title: string;
  body: string;
  segment: string;
  endsAt: string | null;
  dedupeKey: string;
};

export async function publishAnnouncement(
  session: Session,
  webUrl: string,
  draft: AnnouncementDraft,
): Promise<{ announcement: Announcement | null; alreadyCreated: boolean }> {
  const response = await authenticatedWebRequest(
    session,
    webUrl,
    "/api/admin/announcements",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    },
  );
  return (await response.json()) as {
    announcement: Announcement | null;
    alreadyCreated: boolean;
  };
}

export async function pushAnnouncement(
  session: Session,
  webUrl: string,
  announcementId: string,
): Promise<{
  announcement?: Announcement;
  delivered?: number;
  failed?: number;
  recipients?: number;
}> {
  const response = await authenticatedWebRequest(
    session,
    webUrl,
    `/api/admin/announcements/${announcementId}/push`,
    { method: "POST" },
  );
  return (await response.json()) as {
    announcement?: Announcement;
    delivered?: number;
    failed?: number;
    recipients?: number;
  };
}
