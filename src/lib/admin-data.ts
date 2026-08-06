import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AdminUserFacts,
  bucketContactCounts,
  contactCountBuckets,
} from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Announcement } from "@/lib/types";

const pageSize = 1000;
const maxPages = 100;
const dayInMs = 24 * 60 * 60 * 1000;

/**
 * Migrations land by hand, so any table a recent migration introduced may not
 * exist yet. A missing table means "no data", never a 500.
 */
export function isMissingAdminSchema(code: string | undefined) {
  return ["42P01", "42883", "42703", "PGRST202", "PGRST205"].includes(code || "");
}

type RowFilter = {
  column: string;
  since: string;
};

async function fetchAllRows<T>(
  admin: SupabaseClient,
  table: string,
  columns: string,
  filter?: RowFilter,
): Promise<{ rows: T[]; missing: boolean }> {
  const rows: T[] = [];

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize;
    let query = admin
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (filter) query = query.gte(filter.column, filter.since);
    const { data, error } = await query;

    if (error) {
      if (isMissingAdminSchema(error.code)) return { rows: [], missing: true };
      throw new Error(error.message);
    }

    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return { rows, missing: false };
}

function latestTimestamp(current: string | null, candidate: string | null) {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate) > new Date(current) ? candidate : current;
}

/**
 * Only ever reads identifiers and timestamps. No names, emails, or contact
 * details of anyone's people leave the database on this path.
 */
export async function getAdminUserFacts(): Promise<AdminUserFacts[]> {
  const admin = createAdminClient();

  const [profiles, people, webPush, nativePush, interactions] = await Promise.all([
    fetchAllRows<{ auth_user_id: string; created_at: string }>(
      admin,
      "user_profiles",
      "auth_user_id,created_at",
    ),
    fetchAllRows<{ user_id: string; created_at: string }>(
      admin,
      "people",
      "user_id,created_at",
    ),
    fetchAllRows<{ user_id: string; revoked_at: string | null }>(
      admin,
      "push_subscriptions",
      "user_id,revoked_at",
    ),
    fetchAllRows<{ user_id: string; revoked_at: string | null }>(
      admin,
      "native_push_subscriptions",
      "user_id,revoked_at",
    ),
    // Activity only ever matters inside a 30-day window, so there is no reason
    // to pull the entire interaction history to work it out.
    fetchAllRows<{ user_id: string; created_at: string }>(
      admin,
      "interactions",
      "user_id,created_at",
      {
        column: "created_at",
        since: new Date(Date.now() - 31 * dayInMs).toISOString(),
      },
    ),
  ]);

  const facts = new Map<string, AdminUserFacts>();
  for (const profile of profiles.rows) {
    facts.set(profile.auth_user_id, {
      userId: profile.auth_user_id,
      createdAt: profile.created_at,
      contactCount: 0,
      pushEnabled: false,
      // Signing up counts as activity, otherwise a brand-new account reads as
      // dormant on its first day.
      lastActiveAt: profile.created_at,
    });
  }

  for (const person of people.rows) {
    const entry = facts.get(person.user_id);
    if (!entry) continue;
    entry.contactCount += 1;
    entry.lastActiveAt = latestTimestamp(entry.lastActiveAt, person.created_at);
  }

  for (const interaction of interactions.rows) {
    const entry = facts.get(interaction.user_id);
    if (!entry) continue;
    entry.lastActiveAt = latestTimestamp(
      entry.lastActiveAt,
      interaction.created_at,
    );
  }

  for (const subscription of [...webPush.rows, ...nativePush.rows]) {
    if (subscription.revoked_at) continue;
    const entry = facts.get(subscription.user_id);
    if (entry) entry.pushEnabled = true;
  }

  return [...facts.values()];
}

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

function withinDays(iso: string | null, days: number, now: Date) {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return now.getTime() - then <= days * dayInMs;
}

function weekStarting(date: Date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return start;
}

export function summariseUsers(
  users: AdminUserFacts[],
  now: Date = new Date(),
): AdminStats {
  const counts = users.map((facts) => facts.contactCount);
  const buckets = bucketContactCounts(counts);

  const weeks: { weekStarting: string; users: number }[] = [];
  const thisWeek = weekStarting(now);
  for (let index = 11; index >= 0; index -= 1) {
    const start = new Date(thisWeek);
    start.setUTCDate(start.getUTCDate() - index * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    weeks.push({
      weekStarting: start.toISOString().slice(0, 10),
      users: users.filter((facts) => {
        const created = new Date(facts.createdAt);
        return created >= start && created < end;
      }).length,
    });
  }

  return {
    totalUsers: users.length,
    totalContacts: counts.reduce((total, count) => total + count, 0),
    newUsersLast7: users.filter((facts) => withinDays(facts.createdAt, 7, now))
      .length,
    newUsersLast30: users.filter((facts) => withinDays(facts.createdAt, 30, now))
      .length,
    signupsByWeek: weeks,
    contactBuckets: buckets.map(({ bucket, users: bucketUsers }) => ({
      id: bucket.id,
      label: bucket.label,
      users: bucketUsers,
    })),
    pushEnabledUsers: users.filter((facts) => facts.pushEnabled).length,
    activeLast7: users.filter((facts) => withinDays(facts.lastActiveAt, 7, now))
      .length,
    activeLast30: users.filter((facts) => withinDays(facts.lastActiveAt, 30, now))
      .length,
  };
}

export const emptyStats: AdminStats = {
  totalUsers: 0,
  totalContacts: 0,
  newUsersLast7: 0,
  newUsersLast30: 0,
  signupsByWeek: [],
  contactBuckets: contactCountBuckets.map((bucket) => ({
    id: bucket.id,
    label: bucket.label,
    users: 0,
  })),
  pushEnabledUsers: 0,
  activeLast7: 0,
  activeLast30: 0,
};

type AnnouncementRow = {
  id: string;
  title: string;
  body: string;
  segment: string;
  starts_at: string;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
  audience_size: number | null;
  push_sent_at: string | null;
  push_recipient_count: number | null;
  push_delivered_count: number | null;
  push_failed_count: number | null;
};

export function mapAnnouncement(row: AnnouncementRow): Announcement {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    segment: row.segment,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    audienceSize: row.audience_size,
    pushSentAt: row.push_sent_at,
    pushRecipientCount: row.push_recipient_count,
    pushDeliveredCount: row.push_delivered_count,
    pushFailedCount: row.push_failed_count,
  };
}

export const announcementColumns =
  "id,title,body,segment,starts_at,ends_at,created_by,created_at,audience_size,push_sent_at,push_recipient_count,push_delivered_count,push_failed_count";

export type AnnouncementListing = {
  schemaReady: boolean;
  announcements: Announcement[];
};

export async function listAnnouncements(): Promise<AnnouncementListing> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("announcements")
    .select(announcementColumns)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingAdminSchema(error.code)) {
      return { schemaReady: false, announcements: [] };
    }
    throw new Error(error.message);
  }

  return {
    schemaReady: true,
    announcements: (data as AnnouncementRow[]).map(mapAnnouncement),
  };
}
