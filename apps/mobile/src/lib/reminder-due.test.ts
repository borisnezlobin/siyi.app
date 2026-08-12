import { reminderBucket } from "@/lib/reminder-buckets";
import {
  reminderDayFromDaysAway,
  reminderDayLabel,
  reminderDayValue,
  reminderDaysAway,
  reminderDueAt,
  reminderTimeValue,
  parseTimeOfDay,
} from "@/lib/reminder-due";

const now = new Date("2026-03-11T14:30:00.000Z");

describe("quick relative choices", () => {
  it("lands on the expected calendar day", () => {
    expect(reminderDayValue(reminderDayFromDaysAway(0, now))).toBe(
      reminderDayValue(now),
    );
    expect(reminderDaysAway(reminderDayFromDaysAway(1, now), now)).toBe(1);
    expect(reminderDaysAway(reminderDayFromDaysAway(7, now), now)).toBe(7);
    expect(reminderDaysAway(reminderDayFromDaysAway(14, now), now)).toBe(14);
  });

  it("lands at nine in the morning whatever day it is for", () => {
    // Whether it is for today or next week, an unspecified time means the same
    // hour. The two apps disagreed about this before, so it is asserted here
    // and mirrored by the web twin's constant.
    expect(new Date(reminderDueAt(reminderDayFromDaysAway(0, now), now)).getHours()).toBe(9);
    expect(new Date(reminderDueAt(reminderDayFromDaysAway(3, now), now)).getHours()).toBe(9);
  });
});

describe("a specific date chosen from the picker", () => {
  const chosen = new Date(2026, 4, 19, 0, 0, 0, 0);

  it("round-trips through the saved timestamp without drifting a day", () => {
    const dueAt = reminderDueAt(chosen, now);
    const restored = new Date(dueAt);
    expect(reminderDayValue(restored)).toBe("2026-05-19");
    expect(reminderDayValue(restored)).toBe(reminderDayValue(chosen));
  });

  it("round-trips a date the picker hands back with a stray time on it", () => {
    const pickedWithTime = new Date(2026, 4, 19, 23, 47, 12, 500);
    expect(reminderDayValue(new Date(reminderDueAt(pickedWithTime, now)))).toBe(
      "2026-05-19",
    );
  });

  it("round-trips the day either side of a daylight-saving change", () => {
    for (const day of [new Date(2026, 2, 8), new Date(2026, 10, 1)]) {
      expect(reminderDayValue(new Date(reminderDueAt(day, now)))).toBe(
        reminderDayValue(day),
      );
    }
  });

  it("still reads as the right bucket once saved", () => {
    const tomorrow = reminderDayFromDaysAway(1, now);
    expect(reminderBucket(reminderDueAt(tomorrow, now), now)).toBe("week");
    const nextMonth = reminderDayFromDaysAway(30, now);
    expect(reminderBucket(reminderDueAt(nextMonth, now), now)).toBe("later");
  });
});

describe("reminderDayLabel", () => {
  it("names the near days and dates the rest", () => {
    expect(reminderDayLabel(reminderDayFromDaysAway(0, now), now)).toBe("Today");
    expect(reminderDayLabel(reminderDayFromDaysAway(1, now), now)).toBe(
      "Tomorrow",
    );
    expect(reminderDayLabel(new Date(2026, 4, 19), now)).toBe("Tue, May 19");
  });
});

describe("a time the person chose", () => {
  const day = new Date("2026-08-20T00:00:00");
  const now = new Date("2026-08-10T09:00:00");

  it("reads a time of day, and refuses one that is not", () => {
    expect(parseTimeOfDay("14:30")).toEqual({ hours: 14, minutes: 30 });
    expect(parseTimeOfDay("09:05")).toEqual({ hours: 9, minutes: 5 });
    expect(parseTimeOfDay("25:00")).toBeNull();
    expect(parseTimeOfDay("14:60")).toBeNull();
    expect(parseTimeOfDay("half two")).toBeNull();
    expect(parseTimeOfDay("")).toBeNull();
  });

  it("puts the reminder at that time rather than the default", () => {
    const dueAt = new Date(reminderDueAt(day, now, "14:30"));
    expect(dueAt.getHours()).toBe(14);
    expect(dueAt.getMinutes()).toBe(30);
  });

  it("falls back to nine in the morning when no time was given", () => {
    expect(new Date(reminderDueAt(day, now)).getHours()).toBe(9);
    expect(new Date(reminderDueAt(day, now, "nonsense")).getHours()).toBe(9);
  });

  it("reads the time back out of a saved reminder", () => {
    const dueAt = reminderDueAt(day, now, "07:05");
    expect(reminderTimeValue(dueAt)).toBe("07:05");
    expect(reminderTimeValue("not a date")).toBe("");
  });
});
