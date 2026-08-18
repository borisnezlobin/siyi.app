import { describe, expect, it } from "vitest";
import {
  activationFunnel,
  referralStandings,
  retentionCohorts,
  type AdminUserFacts,
} from "@/lib/admin";

const now = new Date("2026-08-16T12:00:00.000Z");
const day = 24 * 60 * 60 * 1000;

function daysAgo(days: number) {
  return new Date(now.getTime() - days * day).toISOString();
}

function user(overrides: Partial<AdminUserFacts>): AdminUserFacts {
  return {
    userId: crypto.randomUUID(),
    createdAt: daysAgo(40),
    contactCount: 0,
    pushEnabled: false,
    lastActiveAt: null,
    marketingOptIn: false,
    emailConfirmedAt: null,
    ...overrides,
  };
}

describe("the activation funnel", () => {
  it("counts each step against accounts old enough to have taken it", () => {
    const funnel = activationFunnel(
      [
        user({ createdAt: daysAgo(10), contactCount: 5, lastActiveAt: daysAgo(2) }),
        user({ createdAt: daysAgo(10), contactCount: 1, lastActiveAt: daysAgo(10) }),
        user({ createdAt: daysAgo(10), contactCount: 0, lastActiveAt: daysAgo(10) }),
      ],
      now,
    );

    expect(funnel).toEqual({
      signedUp: 3,
      addedFirstPerson: 2,
      addedThreePeople: 1,
      returnedAfterFirstDay: 1,
    });
  });

  it("leaves out accounts created in the last day", () => {
    // Someone who signed up an hour ago has not failed to come back — counting
    // them would make the funnel look worse the faster signups arrive.
    const funnel = activationFunnel(
      [user({ createdAt: daysAgo(0), contactCount: 0, lastActiveAt: daysAgo(0) })],
      now,
    );
    expect(funnel.signedUp).toBe(0);
  });

  it("does not treat the signup itself as a return visit", () => {
    // lastActiveAt defaults to the signup timestamp for a brand-new account.
    const created = daysAgo(5);
    const funnel = activationFunnel(
      [user({ createdAt: created, lastActiveAt: created })],
      now,
    );
    expect(funnel.returnedAfterFirstDay).toBe(0);
  });
});

describe("retention cohorts", () => {
  it("reports null, not zero, for a cohort too young to measure", () => {
    const cohorts = retentionCohorts(
      [user({ createdAt: daysAgo(3), lastActiveAt: daysAgo(1) })],
      now,
    );
    // Found by content rather than by position: which cohort a date lands in
    // depends on what weekday `now` happens to be.
    const cohort = cohorts.find((entry) => entry.signedUp === 1);

    expect(cohort).toBeDefined();
    // Three days in, 30-day retention is unknown — and a 0 here would read as
    // total collapse every single week.
    expect(cohort?.activeAfter30).toBeNull();
  });

  it("measures a mature cohort against both windows", () => {
    const cohorts = retentionCohorts(
      [
        user({ createdAt: daysAgo(45), lastActiveAt: daysAgo(10) }),
        user({ createdAt: daysAgo(45), lastActiveAt: daysAgo(44) }),
      ],
      now,
    );
    const cohort = cohorts.find((entry) => entry.signedUp === 2);

    expect(cohort).toBeDefined();
    // One stayed 35 days, the other lasted a day.
    expect(cohort?.activeAfter7).toBe(1);
    expect(cohort?.activeAfter30).toBe(1);
  });

  it("returns one entry per requested week, newest last", () => {
    const cohorts = retentionCohorts([], now, 8);
    expect(cohorts).toHaveLength(8);
    expect(cohorts[0].weekStarting < cohorts[7].weekStarting).toBe(true);
  });
});

describe("referral standings", () => {
  it("credits the referrer's code, not the joiner's", () => {
    const referrer = user({ userId: "ref-1", referralCode: "JQ7MNP2" });
    const standings = referralStandings([
      referrer,
      user({ referredBy: "ref-1", referralCode: "ZZZZZZZ" }),
      user({ referredBy: "ref-1" }),
    ]);

    expect(standings).toEqual([{ code: "JQ7MNP2", joined: 2 }]);
  });

  it("leaves out accounts that referred nobody", () => {
    expect(referralStandings([user({ referralCode: "JQ7MNP2" })])).toEqual([]);
  });
});
