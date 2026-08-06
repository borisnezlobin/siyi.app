import { describe, expect, it } from "vitest";
import {
  isAdminUser,
  type AdminUserFacts,
  bucketContactCounts,
  bucketForContactCount,
  isAdminEmail,
  parseAdminEmails,
  segmentCounts,
  usersInSegment,
} from "@/lib/admin";

const allowlist = "boris@example.com, jerry@example.com";

describe("who is allowed into /admin", () => {
  it("lets an allowlisted email through", () => {
    expect(isAdminEmail("boris@example.com", allowlist)).toBe(true);
    expect(isAdminEmail("jerry@example.com", allowlist)).toBe(true);
  });

  it("keeps a signed-in stranger out", () => {
    expect(isAdminEmail("someone@example.com", allowlist)).toBe(false);
  });

  it("keeps a signed-out visitor out", () => {
    expect(isAdminEmail(null, allowlist)).toBe(false);
    expect(isAdminEmail(undefined, allowlist)).toBe(false);
    expect(isAdminEmail("", allowlist)).toBe(false);
  });

  it("ignores case and stray whitespace on both sides", () => {
    expect(isAdminEmail("  Boris@Example.COM  ", allowlist)).toBe(true);
    expect(isAdminEmail("BORIS@EXAMPLE.COM", "  BoRiS@example.com  ")).toBe(true);
  });

  it("lets nobody in when the allowlist is unset or empty", () => {
    expect(isAdminEmail("boris@example.com", undefined)).toBe(false);
    expect(isAdminEmail("boris@example.com", "")).toBe(false);
    expect(isAdminEmail("boris@example.com", " , , ")).toBe(false);
  });

  it("does not treat a lookalike email as a match", () => {
    expect(isAdminEmail("boris@example.com.evil.com", allowlist)).toBe(false);
    expect(isAdminEmail("xboris@example.com", allowlist)).toBe(false);
  });

  it("parses the environment variable into normalised emails", () => {
    expect(parseAdminEmails(" A@b.com ,C@D.com,")).toEqual([
      "a@b.com",
      "c@d.com",
    ]);
  });
});

const now = new Date("2026-08-06T12:00:00.000Z");

function user(overrides: Partial<AdminUserFacts> & { userId: string }): AdminUserFacts {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    contactCount: 0,
    pushEnabled: false,
    lastActiveAt: now.toISOString(),
    ...overrides,
  };
}

const population: AdminUserFacts[] = [
  user({ userId: "quiet", lastActiveAt: "2026-06-01T12:00:00.000Z" }),
  user({ userId: "busy", contactCount: 240, pushEnabled: true }),
  user({ userId: "exactly-100", contactCount: 100 }),
  user({ userId: "ninety-nine", contactCount: 99, pushEnabled: true }),
  user({ userId: "never-active", lastActiveAt: null }),
];

describe("segment membership", () => {
  it("includes everyone in the all-users segment", () => {
    expect(usersInSegment(population, "all", now)).toHaveLength(5);
  });

  it("counts 100 contacts as a member of the many-contacts segment", () => {
    const members = usersInSegment(population, "many-contacts", now).map(
      (facts) => facts.userId,
    );
    expect(members).toEqual(["busy", "exactly-100"]);
  });

  it("finds only accounts with a live push subscription", () => {
    const members = usersInSegment(population, "push-enabled", now).map(
      (facts) => facts.userId,
    );
    expect(members).toEqual(["busy", "ninety-nine"]);
  });

  it("treats a 30-day silence and never-active alike", () => {
    const members = usersInSegment(population, "inactive-30-days", now).map(
      (facts) => facts.userId,
    );
    expect(members).toEqual(["quiet", "never-active"]);
  });

  it("holds the inactivity boundary at exactly 30 days", () => {
    const thirtyDays = user({
      userId: "edge",
      lastActiveAt: "2026-07-07T12:00:00.000Z",
    });
    const thirtyOneDays = user({
      userId: "past-edge",
      lastActiveAt: "2026-07-06T11:00:00.000Z",
    });
    expect(usersInSegment([thirtyDays], "inactive-30-days", now)).toHaveLength(0);
    expect(usersInSegment([thirtyOneDays], "inactive-30-days", now)).toHaveLength(1);
  });

  it("returns nobody for an unknown segment rather than everybody", () => {
    expect(usersInSegment(population, "not-a-segment", now)).toEqual([]);
  });

  it("counts every segment in one pass", () => {
    expect(segmentCounts(population, now)).toEqual({
      all: 5,
      "many-contacts": 2,
      "push-enabled": 2,
      "inactive-30-days": 2,
    });
  });
});

describe("contact-count buckets", () => {
  it("places each boundary in the bucket its label promises", () => {
    const boundaries: [number, string][] = [
      [0, "0"],
      [1, "1-10"],
      [10, "1-10"],
      [11, "11-50"],
      [50, "11-50"],
      [51, "51-100"],
      [100, "51-100"],
      [101, "100+"],
      [5000, "100+"],
    ];
    for (const [count, bucketId] of boundaries) {
      expect(bucketForContactCount(count).id).toBe(bucketId);
    }
  });

  it("clamps nonsense counts into the zero bucket", () => {
    expect(bucketForContactCount(-4).id).toBe("0");
  });

  it("tallies a population into every bucket, including empty ones", () => {
    expect(bucketContactCounts([0, 0, 7, 50, 51, 101])).toEqual([
      { bucket: expect.objectContaining({ id: "0" }), users: 2 },
      { bucket: expect.objectContaining({ id: "1-10" }), users: 1 },
      { bucket: expect.objectContaining({ id: "11-50" }), users: 1 },
      { bucket: expect.objectContaining({ id: "51-100" }), users: 1 },
      { bucket: expect.objectContaining({ id: "100+" }), users: 1 },
    ]);
  });
});

describe("deciding who is an admin", () => {
  const confirmed = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "boris@example.com",
    emailConfirmedAt: "2026-01-01T00:00:00Z",
  };
  const emails = { adminEmails: "boris@example.com", adminUserIds: null };

  it("lets a confirmed allowlisted address in", () => {
    expect(isAdminUser(confirmed, emails)).toBe(true);
  });

  it("refuses an allowlisted address that was never confirmed", () => {
    // Signup is open, so an unconfirmed address proves nothing about who owns it.
    expect(
      isAdminUser({ ...confirmed, emailConfirmedAt: null }, emails),
    ).toBe(false);
  });

  it("ignores the email allowlist entirely once user ids are set", () => {
    const byId = {
      adminEmails: "boris@example.com",
      adminUserIds: "99999999-9999-4999-8999-999999999999",
    };

    expect(isAdminUser(confirmed, byId)).toBe(false);
    expect(isAdminUser({ ...confirmed, id: "99999999-9999-4999-8999-999999999999" }, byId)).toBe(true);
  });

  it("still matches an id even when the address is unconfirmed", () => {
    const byId = { adminEmails: null, adminUserIds: confirmed.id };

    expect(
      isAdminUser({ ...confirmed, emailConfirmedAt: null }, byId),
    ).toBe(true);
  });

  it("admits nobody when neither variable is set", () => {
    expect(
      isAdminUser(confirmed, { adminEmails: null, adminUserIds: null }),
    ).toBe(false);
    expect(isAdminUser(null, emails)).toBe(false);
  });

  it("tolerates spacing in the id list", () => {
    expect(
      isAdminUser(confirmed, {
        adminEmails: null,
        adminUserIds: ` ${confirmed.id} , other `,
      }),
    ).toBe(true);
  });
});
