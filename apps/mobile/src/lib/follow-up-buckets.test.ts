import {
  countsByBucket,
  followUpBucket,
  followUpDueLabel,
  groupFollowUpsByBucket,
} from "@/lib/follow-up-buckets";

const now = new Date("2026-03-11T14:30:00.000Z");

function at(offsetDays: number, hour = 12) {
  const date = new Date(now);
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

describe("followUpBucket", () => {
  it("sorts an item from each part of the horizon", () => {
    expect(followUpBucket(at(-3), now)).toBe("overdue");
    expect(followUpBucket(at(0), now)).toBe("today");
    expect(followUpBucket(at(3), now)).toBe("week");
    expect(followUpBucket(at(20), now)).toBe("later");
  });

  it("treats yesterday late at night as overdue and today early as today", () => {
    expect(followUpBucket(at(-1, 23), now)).toBe("overdue");
    expect(followUpBucket(at(0, 0), now)).toBe("today");
    expect(followUpBucket(at(0, 23), now)).toBe("today");
  });

  it("puts the boundaries of this week on the right side", () => {
    expect(followUpBucket(at(1), now)).toBe("week");
    expect(followUpBucket(at(6), now)).toBe("week");
    expect(followUpBucket(at(7), now)).toBe("later");
  });
});

describe("groupFollowUpsByBucket", () => {
  const followUps = [
    { id: "later", dueAt: at(9), completedAt: null },
    { id: "overdue", dueAt: at(-2), completedAt: null },
    { id: "today", dueAt: at(0), completedAt: null },
    { id: "week", dueAt: at(4), completedAt: null },
    { id: "week-sooner", dueAt: at(2), completedAt: null },
    { id: "done", dueAt: at(-5), completedAt: at(-4) },
  ];

  it("places every open item in exactly one bucket, soonest first", () => {
    const { groups } = groupFollowUpsByBucket(followUps, now);
    expect(groups.overdue.map((item) => item.id)).toEqual(["overdue"]);
    expect(groups.today.map((item) => item.id)).toEqual(["today"]);
    expect(groups.week.map((item) => item.id)).toEqual(["week-sooner", "week"]);
    expect(groups.later.map((item) => item.id)).toEqual(["later"]);
  });

  it("keeps completed items out of the time buckets", () => {
    const { groups, completed } = groupFollowUpsByBucket(followUps, now);
    expect(completed.map((item) => item.id)).toEqual(["done"]);
    expect(countsByBucket(groups)).toEqual({
      overdue: 1,
      today: 1,
      week: 2,
      later: 1,
    });
  });
});

describe("followUpDueLabel", () => {
  it("reads as plain language on both sides of today", () => {
    expect(followUpDueLabel(at(0), now)).toBe("Today");
    expect(followUpDueLabel(at(1), now)).toBe("Tomorrow");
    expect(followUpDueLabel(at(5), now)).toBe("In 5 days");
    expect(followUpDueLabel(at(-1), now)).toBe("1 day late");
    expect(followUpDueLabel(at(-4), now)).toBe("4 days late");
  });
});
