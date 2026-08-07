import { describe, expect, it } from "vitest";
import {
  dueDateLabel,
  dueDateLabelFromDaysAway,
  lastSeenLabel,
  relativeDateLabel,
} from "@/lib/relative-time";

// Local time throughout: the rule is about the day a user was living in.
const now = new Date(2026, 2, 11, 14, 30);

describe("relativeDateLabel", () => {
  it("calls the current day Today, however long ago in it", () => {
    expect(relativeDateLabel(new Date(2026, 2, 11, 14, 7), now)).toBe("Today");
    expect(relativeDateLabel(new Date(2026, 2, 11, 0, 1), now)).toBe("Today");
  });

  it("treats a future timestamp as Today rather than counting backwards", () => {
    expect(relativeDateLabel(new Date(2026, 2, 11, 23, 59), now)).toBe("Today");
  });

  it("names yesterday", () => {
    expect(relativeDateLabel(new Date(2026, 2, 10, 9, 0), now)).toBe("Yesterday");
  });

  it("says Yesterday a few minutes after midnight, not minutes ago", () => {
    const justAfterMidnight = new Date(2026, 2, 11, 0, 2);
    const justBeforeMidnight = new Date(2026, 2, 10, 23, 58);
    expect(relativeDateLabel(justBeforeMidnight, justAfterMidnight)).toBe("Yesterday");
  });

  it("keeps the last minute of today on today", () => {
    const justBeforeMidnight = new Date(2026, 2, 11, 23, 58);
    const midnight = new Date(2026, 2, 11, 23, 59);
    expect(relativeDateLabel(justBeforeMidnight, midnight)).toBe("Today");
  });

  it("counts the days up to a week", () => {
    expect(relativeDateLabel(new Date(2026, 2, 9, 9, 0), now)).toBe("2 days ago");
    expect(relativeDateLabel(new Date(2026, 2, 5, 9, 0), now)).toBe("6 days ago");
  });

  it("shows a date once a countdown stops meaning anything", () => {
    expect(relativeDateLabel(new Date(2026, 2, 4, 9, 0), now)).toBe("Mar 4");
    expect(relativeDateLabel(new Date(2026, 0, 18, 9, 0), now)).toBe("Jan 18");
  });

  it("adds the year once it is no longer this one", () => {
    expect(relativeDateLabel(new Date(2024, 10, 2, 9, 0), now)).toBe("Nov 2, 2024");
  });
});

describe("lastSeenLabel", () => {
  it("says so when there is nothing to date", () => {
    expect(lastSeenLabel(null, now)).toBe("No interactions yet");
  });

  it("otherwise reads exactly like every other relative date", () => {
    expect(lastSeenLabel(new Date(2026, 2, 10, 9, 0), now)).toBe("Yesterday");
  });
});

describe("dueDateLabel", () => {
  it("leaves today and tomorrow alone, because they already name the day", () => {
    expect(dueDateLabel(new Date(2026, 2, 11, 20, 0), now)).toBe("Due today");
    expect(dueDateLabel(new Date(2026, 2, 12, 17, 0), now)).toBe("Due tomorrow");
  });

  it("puts the real date next to a countdown", () => {
    expect(dueDateLabel(new Date(2026, 2, 16, 17, 0), now)).toBe("Due in 5 days · Mar 16");
  });

  it("dates an overdue reminder too", () => {
    expect(dueDateLabel(new Date(2026, 2, 10, 17, 0), now)).toBe("1 day overdue · Mar 10");
    expect(dueDateLabel(new Date(2026, 2, 7, 17, 0), now)).toBe("4 days overdue · Mar 7");
  });

  it("spells the year out when the reminder is not in this one", () => {
    expect(dueDateLabel(new Date(2027, 0, 4, 17, 0), now)).toBe(
      "Due in 299 days · Jan 4, 2027",
    );
  });
});

describe("dueDateLabelFromDaysAway", () => {
  it("rebuilds the same wording from a day count alone", () => {
    expect(dueDateLabelFromDaysAway(0, now)).toBe("Due today");
    expect(dueDateLabelFromDaysAway(5, now)).toBe("Due in 5 days · Mar 16");
    expect(dueDateLabelFromDaysAway(-4, now)).toBe("4 days overdue · Mar 7");
  });
});
