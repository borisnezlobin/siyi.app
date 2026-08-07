import { reminderBucket } from "@/lib/reminder-buckets";
import {
  reminderDayFromDaysAway,
  reminderDayLabel,
  reminderDayValue,
  reminderDaysAway,
  reminderDueAt,
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

  it("gives today until the evening and other days the late afternoon", () => {
    expect(new Date(reminderDueAt(reminderDayFromDaysAway(0, now), now)).getHours()).toBe(20);
    expect(new Date(reminderDueAt(reminderDayFromDaysAway(3, now), now)).getHours()).toBe(17);
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
