/**
 * Pure admin logic: who counts as an admin, how users are grouped into
 * segments, and how contact counts fall into buckets. Nothing here touches the
 * database, so all of it is directly testable.
 */

export type AdminUserFacts = {
  userId: string;
  createdAt: string;
  contactCount: number;
  pushEnabled: boolean;
  lastActiveAt: string | null;
  marketingOptIn: boolean;
  emailConfirmedAt: string | null;
  /** The account that referred this one, if any. */
  referredBy?: string | null;
  /** This account's own code, present only once it has asked for one. */
  referralCode?: string | null;
};

export type AdminSegment = {
  id: string;
  label: string;
  description: string;
  matches: (facts: AdminUserFacts, now: Date) => boolean;
};

export const manyContactsThreshold = 100;
export const inactivityDays = 30;

const dayInMs = 24 * 60 * 60 * 1000;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseAdminEmails(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map(normalizeEmail)
    .filter((email) => email.length > 0);
}

export function isAdminEmail(
  email: string | null | undefined,
  raw: string | undefined | null = process.env.ADMIN_EMAILS,
): boolean {
  if (!email) return false;
  const allowlist = parseAdminEmails(raw);
  if (allowlist.length === 0) return false;
  return allowlist.includes(normalizeEmail(email));
}

export type AdminIdentity = {
  id: string;
  email: string | null | undefined;
  emailConfirmedAt: string | null | undefined;
};

export function parseAdminUserIds(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
}

/**
 * Signup is open, so an email allowlist alone only holds while Supabase is
 * confirming addresses — turn confirmations off and anyone could register the
 * admin address and claim the account. Auth user ids cannot be claimed that
 * way, so when ADMIN_USER_IDS is set it decides on its own. Falling back to
 * email additionally requires the address to have been confirmed.
 */
export function isAdminUser(
  user: AdminIdentity | null | undefined,
  env: {
    adminUserIds?: string | null;
    adminEmails?: string | null;
  } = {
    adminUserIds: process.env.ADMIN_USER_IDS,
    adminEmails: process.env.ADMIN_EMAILS,
  },
): boolean {
  if (!user) return false;

  const allowedIds = parseAdminUserIds(env.adminUserIds);
  if (allowedIds.length > 0) return allowedIds.includes(user.id);

  if (!user.emailConfirmedAt) return false;
  return isAdminEmail(user.email, env.adminEmails);
}

export function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return (now.getTime() - then) / dayInMs;
}

export function activeWithinDays(
  facts: AdminUserFacts,
  days: number,
  now: Date,
): boolean {
  const elapsed = daysSince(facts.lastActiveAt, now);
  return elapsed !== null && elapsed <= days;
}

export const adminSegments: AdminSegment[] = [
  {
    id: "all",
    label: "Everyone",
    description: "Every account with a profile.",
    matches: () => true,
  },
  {
    id: "many-contacts",
    label: `${manyContactsThreshold} or more contacts`,
    description: `People whose directory has at least ${manyContactsThreshold} contacts.`,
    matches: (facts) => facts.contactCount >= manyContactsThreshold,
  },
  {
    id: "push-enabled",
    label: "Push turned on",
    description: "Accounts with at least one live push subscription.",
    matches: (facts) => facts.pushEnabled,
  },
  {
    id: "inactive-30-days",
    label: `Quiet for ${inactivityDays} days`,
    description: `No recorded activity in the last ${inactivityDays} days.`,
    matches: (facts, now) => !activeWithinDays(facts, inactivityDays, now),
  },
  {
    id: "no-contacts",
    label: "No contacts yet",
    description: "Signed up but has not saved anyone.",
    matches: (facts) => facts.contactCount === 0,
  },
  {
    id: "email-unverified",
    label: "Email not verified",
    description: "Never followed the confirmation link.",
    matches: (facts) => facts.emailConfirmedAt === null,
  },
  {
    id: "marketing-subscribed",
    label: "Subscribed to email",
    description: "Agreed to hear from us, and has not unsubscribed.",
    matches: (facts) => facts.marketingOptIn,
  },
];

/**
 * The three ways an account can be idle. They overlap on purpose — someone can
 * be quiet, contactless and unverified all at once — so these are never summed
 * into a single "idle" figure.
 */
export type IdleCounts = {
  quiet: number;
  withoutContacts: number;
  emailUnverified: number;
};

export function countIdleUsers(
  users: AdminUserFacts[],
  now: Date = new Date(),
): IdleCounts {
  return {
    quiet: users.filter((facts) => !activeWithinDays(facts, inactivityDays, now))
      .length,
    withoutContacts: users.filter((facts) => facts.contactCount === 0).length,
    emailUnverified: users.filter((facts) => facts.emailConfirmedAt === null)
      .length,
  };
}

/** How many of each segment agreed to hear from us. */
export function subscriberCounts(
  users: AdminUserFacts[],
  now: Date = new Date(),
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const segment of adminSegments) {
    counts[segment.id] = users.filter(
      (facts) => facts.marketingOptIn && segment.matches(facts, now),
    ).length;
  }
  return counts;
}

export function findSegment(segmentId: string): AdminSegment | null {
  return adminSegments.find((segment) => segment.id === segmentId) ?? null;
}

export function usersInSegment(
  users: AdminUserFacts[],
  segmentId: string,
  now: Date = new Date(),
): AdminUserFacts[] {
  const segment = findSegment(segmentId);
  if (!segment) return [];
  return users.filter((facts) => segment.matches(facts, now));
}

export function segmentCounts(
  users: AdminUserFacts[],
  now: Date = new Date(),
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const segment of adminSegments) {
    counts[segment.id] = users.filter((facts) =>
      segment.matches(facts, now),
    ).length;
  }
  return counts;
}

export type ContactCountBucket = {
  id: string;
  label: string;
  min: number;
  max: number | null;
};

/**
 * `max: null` is the open-ended top bucket, so "100+" here means strictly more
 * than 100 — an account holding exactly 100 contacts sits in "51-100".
 */
export const contactCountBuckets: ContactCountBucket[] = [
  { id: "0", label: "0", min: 0, max: 0 },
  { id: "1-10", label: "1-10", min: 1, max: 10 },
  { id: "11-50", label: "11-50", min: 11, max: 50 },
  { id: "51-100", label: "51-100", min: 51, max: 100 },
  { id: "100+", label: "100+", min: 101, max: null },
];

export function bucketForContactCount(count: number): ContactCountBucket {
  const safeCount = Math.max(0, Math.floor(count));
  const bucket = contactCountBuckets.find(
    ({ min, max }) => safeCount >= min && (max === null || safeCount <= max),
  );
  return bucket ?? contactCountBuckets[contactCountBuckets.length - 1];
}

export function bucketContactCounts(
  counts: number[],
): { bucket: ContactCountBucket; users: number }[] {
  return contactCountBuckets.map((bucket) => ({
    bucket,
    users: counts.filter((count) => bucketForContactCount(count).id === bucket.id)
      .length,
  }));
}

/**
 * Retention and activation.
 *
 * The question this answers is the one that matters after a growth push: people
 * arrived, so did they stay? Both are computed from facts already collected —
 * when an account was created and when it was last active — so nothing new has
 * to be recorded to start seeing the answer.
 */

export type ActivationFunnel = {
  signedUp: number;
  addedFirstPerson: number;
  addedThreePeople: number;
  returnedAfterFirstDay: number;
};

/**
 * Where people fall out between signing up and having a reason to come back.
 *
 * Restricted to accounts old enough to have had the chance: an account created
 * this morning has not failed to return, it simply has not had a second day
 * yet, and counting it as a drop-off makes every funnel look worse the faster
 * you are growing.
 */
export function activationFunnel(
  users: AdminUserFacts[],
  now: Date = new Date(),
): ActivationFunnel {
  const eligible = users.filter((facts) => {
    const created = new Date(facts.createdAt).getTime();
    return !Number.isNaN(created) && now.getTime() - created >= dayInMs;
  });

  return {
    signedUp: eligible.length,
    addedFirstPerson: eligible.filter((facts) => facts.contactCount >= 1).length,
    addedThreePeople: eligible.filter((facts) => facts.contactCount >= 3).length,
    returnedAfterFirstDay: eligible.filter((facts) => {
      if (!facts.lastActiveAt) return false;
      const created = new Date(facts.createdAt).getTime();
      const active = new Date(facts.lastActiveAt).getTime();
      if (Number.isNaN(created) || Number.isNaN(active)) return false;
      // Activity strictly after the first 24 hours. `lastActiveAt` defaults to
      // the signup timestamp, so anything inside that window is the signup
      // itself rather than a return visit.
      return active - created >= dayInMs;
    }).length,
  };
}

export type RetentionCohort = {
  weekStarting: string;
  signedUp: number;
  /** Still active at least a week after joining. */
  activeAfter7: number;
  /** Still active at least a month after joining. Null until the cohort is old enough to say. */
  activeAfter30: number | null;
};

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return start;
}

/**
 * Weekly signup cohorts and how many of each were still around later.
 *
 * A cohort younger than the window it is being measured against reports null
 * rather than zero. A two-week-old cohort has not failed its 30-day retention;
 * it has not reached it, and showing a 0% there would read as a catastrophe
 * every single week.
 */
export function retentionCohorts(
  users: AdminUserFacts[],
  now: Date = new Date(),
  weeks = 8,
): RetentionCohort[] {
  const cohorts: RetentionCohort[] = [];
  const thisWeek = startOfWeek(now);

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const start = new Date(thisWeek);
    start.setUTCDate(start.getUTCDate() - index * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);

    const members = users.filter((facts) => {
      const created = new Date(facts.createdAt);
      return !Number.isNaN(created.getTime()) && created >= start && created < end;
    });

    const survivedFor = (days: number) =>
      members.filter((facts) => {
        if (!facts.lastActiveAt) return false;
        const created = new Date(facts.createdAt).getTime();
        const active = new Date(facts.lastActiveAt).getTime();
        if (Number.isNaN(created) || Number.isNaN(active)) return false;
        return active - created >= days * dayInMs;
      }).length;

    // Measured from the end of the cohort week, so the youngest member has also
    // had the full window.
    const cohortMature = (days: number) =>
      now.getTime() - end.getTime() >= days * dayInMs;

    cohorts.push({
      weekStarting: start.toISOString().slice(0, 10),
      signedUp: members.length,
      activeAfter7: survivedFor(7),
      activeAfter30: cohortMature(30) ? survivedFor(30) : null,
    });
  }

  return cohorts;
}

export type ReferralStanding = { code: string; joined: number };

/**
 * Who has brought the most people in. Codes rather than names or ids: the
 * question an ambassador programme asks is which codes are working, and there
 * is no reason for that screen to identify anybody.
 */
export function referralStandings(
  users: AdminUserFacts[],
  limit = 20,
): ReferralStanding[] {
  const joinedBy = new Map<string, number>();
  for (const facts of users) {
    if (!facts.referredBy) continue;
    joinedBy.set(facts.referredBy, (joinedBy.get(facts.referredBy) ?? 0) + 1);
  }

  const codeFor = new Map(
    users
      .filter((facts) => facts.referralCode)
      .map((facts) => [facts.userId, facts.referralCode as string]),
  );

  return [...joinedBy.entries()]
    .map(([userId, joined]) => ({ code: codeFor.get(userId) ?? "unknown", joined }))
    .sort((a, b) => b.joined - a.joined || a.code.localeCompare(b.code))
    .slice(0, limit);
}
