import { followUpBucket } from "@/lib/follow-up-buckets";
import {
  followUpDayFromDaysAway,
  followUpDayLabel,
  followUpDayValue,
  followUpDaysAway,
  followUpDueAt,
} from "@/lib/follow-up-due";

const now = new Date("2026-03-11T14:30:00.000Z");

describe("quick relative choices", () => {
  it("lands on the expected calendar day", () => {
    expect(followUpDayValue(followUpDayFromDaysAway(0, now))).toBe(
      followUpDayValue(now),
    );
    expect(followUpDaysAway(followUpDayFromDaysAway(1, now), now)).toBe(1);
    expect(followUpDaysAway(followUpDayFromDaysAway(7, now), now)).toBe(7);
    expect(followUpDaysAway(followUpDayFromDaysAway(14, now), now)).toBe(14);
  });

  it("gives today until the evening and other days the late afternoon", () => {
    expect(new Date(followUpDueAt(followUpDayFromDaysAway(0, now), now)).getHours()).toBe(20);
    expect(new Date(followUpDueAt(followUpDayFromDaysAway(3, now), now)).getHours()).toBe(17);
  });
});

describe("a specific date chosen from the picker", () => {
  const chosen = new Date(2026, 4, 19, 0, 0, 0, 0);

  it("round-trips through the saved timestamp without drifting a day", () => {
    const dueAt = followUpDueAt(chosen, now);
    const restored = new Date(dueAt);
    expect(followUpDayValue(restored)).toBe("2026-05-19");
    expect(followUpDayValue(restored)).toBe(followUpDayValue(chosen));
  });

  it("round-trips a date the picker hands back with a stray time on it", () => {
    const pickedWithTime = new Date(2026, 4, 19, 23, 47, 12, 500);
    expect(followUpDayValue(new Date(followUpDueAt(pickedWithTime, now)))).toBe(
      "2026-05-19",
    );
  });

  it("round-trips the day either side of a daylight-saving change", () => {
    for (const day of [new Date(2026, 2, 8), new Date(2026, 10, 1)]) {
      expect(followUpDayValue(new Date(followUpDueAt(day, now)))).toBe(
        followUpDayValue(day),
      );
    }
  });

  it("still reads as the right bucket once saved", () => {
    const tomorrow = followUpDayFromDaysAway(1, now);
    expect(followUpBucket(followUpDueAt(tomorrow, now), now)).toBe("week");
    const nextMonth = followUpDayFromDaysAway(30, now);
    expect(followUpBucket(followUpDueAt(nextMonth, now), now)).toBe("later");
  });
});

describe("followUpDayLabel", () => {
  it("names the near days and dates the rest", () => {
    expect(followUpDayLabel(followUpDayFromDaysAway(0, now), now)).toBe("Today");
    expect(followUpDayLabel(followUpDayFromDaysAway(1, now), now)).toBe(
      "Tomorrow",
    );
    expect(followUpDayLabel(new Date(2026, 4, 19), now)).toBe("Tue, May 19");
  });
});
