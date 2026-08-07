import {
  countsByBucket,
  reminderBucket,
  reminderDueLabel,
  groupRemindersByBucket,
} from "@/lib/reminder-buckets";

const now = new Date("2026-03-11T14:30:00.000Z");

function at(offsetDays: number, hour = 12) {
  const date = new Date(now);
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
}

describe("reminderBucket", () => {
  it("sorts an item from each part of the horizon", () => {
    expect(reminderBucket(at(-3), now)).toBe("overdue");
    expect(reminderBucket(at(0), now)).toBe("today");
    expect(reminderBucket(at(3), now)).toBe("week");
    expect(reminderBucket(at(20), now)).toBe("later");
  });

  it("treats yesterday late at night as overdue and today early as today", () => {
    expect(reminderBucket(at(-1, 23), now)).toBe("overdue");
    expect(reminderBucket(at(0, 0), now)).toBe("today");
    expect(reminderBucket(at(0, 23), now)).toBe("today");
  });

  it("puts the boundaries of this week on the right side", () => {
    expect(reminderBucket(at(1), now)).toBe("week");
    expect(reminderBucket(at(6), now)).toBe("week");
    expect(reminderBucket(at(7), now)).toBe("later");
  });
});

describe("groupRemindersByBucket", () => {
  const reminders = [
    { id: "later", dueAt: at(9), completedAt: null },
    { id: "overdue", dueAt: at(-2), completedAt: null },
    { id: "today", dueAt: at(0), completedAt: null },
    { id: "week", dueAt: at(4), completedAt: null },
    { id: "week-sooner", dueAt: at(2), completedAt: null },
    { id: "done", dueAt: at(-5), completedAt: at(-4) },
  ];

  it("places every open item in exactly one bucket, soonest first", () => {
    const { groups } = groupRemindersByBucket(reminders, now);
    expect(groups.overdue.map((item) => item.id)).toEqual(["overdue"]);
    expect(groups.today.map((item) => item.id)).toEqual(["today"]);
    expect(groups.week.map((item) => item.id)).toEqual(["week-sooner", "week"]);
    expect(groups.later.map((item) => item.id)).toEqual(["later"]);
  });

  it("keeps completed items out of the time buckets", () => {
    const { groups, completed } = groupRemindersByBucket(reminders, now);
    expect(completed.map((item) => item.id)).toEqual(["done"]);
    expect(countsByBucket(groups)).toEqual({
      overdue: 1,
      today: 1,
      week: 2,
      later: 1,
    });
  });
});

describe("reminderDueLabel", () => {
  it("reads as plain language on both sides of today", () => {
    expect(reminderDueLabel(at(0), now)).toBe("Today");
    expect(reminderDueLabel(at(1), now)).toBe("Tomorrow");
    expect(reminderDueLabel(at(5), now)).toBe("In 5 days");
    expect(reminderDueLabel(at(-1), now)).toBe("1 day late");
    expect(reminderDueLabel(at(-4), now)).toBe("4 days late");
  });
});
