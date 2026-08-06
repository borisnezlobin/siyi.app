import { describe, expect, it } from "vitest";
import type { AdminUserFacts } from "@/lib/admin";
import { isMissingAdminSchema, summariseUsers } from "@/lib/admin-data";

const now = new Date("2026-08-06T12:00:00.000Z");

function user(overrides: Partial<AdminUserFacts> & { userId: string }): AdminUserFacts {
  return {
    createdAt: "2026-01-01T00:00:00.000Z",
    contactCount: 0,
    pushEnabled: false,
    lastActiveAt: null,
    ...overrides,
  };
}

describe("aggregate stats", () => {
  const users = [
    user({
      userId: "user-alpha",
      createdAt: "2026-08-04T00:00:00.000Z",
      contactCount: 120,
      pushEnabled: true,
      lastActiveAt: "2026-08-05T00:00:00.000Z",
    }),
    user({
      userId: "user-beta",
      createdAt: "2026-07-20T00:00:00.000Z",
      contactCount: 100,
      lastActiveAt: "2026-07-25T00:00:00.000Z",
    }),
    user({
      userId: "user-gamma",
      createdAt: "2025-03-01T00:00:00.000Z",
      contactCount: 0,
      lastActiveAt: "2025-03-01T00:00:00.000Z",
    }),
  ];

  it("counts users, contacts, and push without naming anyone", () => {
    const stats = summariseUsers(users, now);
    expect(stats.totalUsers).toBe(3);
    expect(stats.totalContacts).toBe(220);
    expect(stats.pushEnabledUsers).toBe(1);
    const serialised = JSON.stringify(stats);
    for (const facts of users) {
      expect(serialised).not.toContain(facts.userId);
    }
  });

  it("splits new and active users across the 7 and 30 day windows", () => {
    const stats = summariseUsers(users, now);
    expect(stats.newUsersLast7).toBe(1);
    expect(stats.newUsersLast30).toBe(2);
    expect(stats.activeLast7).toBe(1);
    expect(stats.activeLast30).toBe(2);
  });

  it("puts exactly 100 contacts in the 51-100 bucket", () => {
    const stats = summariseUsers(users, now);
    expect(stats.contactBuckets).toEqual([
      { id: "0", label: "0", users: 1 },
      { id: "1-10", label: "1-10", users: 0 },
      { id: "11-50", label: "11-50", users: 0 },
      { id: "51-100", label: "51-100", users: 1 },
      { id: "100+", label: "100+", users: 1 },
    ]);
  });

  it("reports twelve weeks of sign-ups ending with the current week", () => {
    const stats = summariseUsers(users, now);
    expect(stats.signupsByWeek).toHaveLength(12);
    expect(stats.signupsByWeek.at(-1)?.weekStarting).toBe("2026-08-02");
    expect(stats.signupsByWeek.at(-1)?.users).toBe(1);
    expect(
      stats.signupsByWeek.reduce((total, week) => total + week.users, 0),
    ).toBe(2);
  });

  it("treats a missing table or column as no data, not an error", () => {
    for (const code of ["42P01", "42883", "42703", "PGRST202", "PGRST205"]) {
      expect(isMissingAdminSchema(code)).toBe(true);
    }
    expect(isMissingAdminSchema("42501")).toBe(false);
    expect(isMissingAdminSchema(undefined)).toBe(false);
  });
});
