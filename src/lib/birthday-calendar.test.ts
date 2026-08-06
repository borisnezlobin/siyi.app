import { describe, expect, it } from "vitest";
import {
  birthdayCountdownLabel,
  birthdaysByMonth,
  daysUntilBirthday,
  upcomingBirthdays,
} from "@/lib/birthday-calendar";

const today = new Date(2026, 7, 6, 12, 0, 0);

const person = (id: string, fullName: string, birthday: string | null) => ({
  id,
  fullName,
  birthday,
});

describe("daysUntilBirthday", () => {
  it("counts today as zero", () => {
    expect(daysUntilBirthday("2001-08-06", today)).toBe(0);
  });

  it("counts a birthday later this year", () => {
    expect(daysUntilBirthday("2001-08-16", today)).toBe(10);
  });

  it("rolls past birthdays into next year", () => {
    expect(daysUntilBirthday("2001-08-05", today)).toBe(364);
  });

  it("handles a 29 February birthday in a common year", () => {
    expect(daysUntilBirthday("2000-02-29", today)).toBeGreaterThan(0);
  });

  it("returns null when there is no birthday", () => {
    expect(daysUntilBirthday(null, today)).toBeNull();
    expect(daysUntilBirthday("not-a-date", today)).toBeNull();
  });
});

describe("birthdaysByMonth", () => {
  it("returns all twelve months, in calendar order", () => {
    const months = birthdaysByMonth([], today);
    expect(months).toHaveLength(12);
    expect(months[0].label).toBe("January");
    expect(months[11].label).toBe("December");
  });

  it("files each person under their month, sorted by day", () => {
    const months = birthdaysByMonth(
      [
        person("1", "Late March", "2001-03-28"),
        person("2", "Early March", "2000-03-03"),
        person("3", "June", "1999-06-15"),
      ],
      today,
    );
    expect(months[2].entries.map((entry) => entry.person.fullName)).toEqual([
      "Early March",
      "Late March",
    ]);
    expect(months[5].entries).toHaveLength(1);
  });

  it("leaves out people with no birthday", () => {
    const months = birthdaysByMonth([person("1", "Unknown", null)], today);
    expect(months.every((month) => month.entries.length === 0)).toBe(true);
  });

  it("reports the age they are turning next, not the age they are now", () => {
    // Born March 2000, and today is August 2026: they have already turned 26,
    // so the birthday this view is counting towards is their 27th.
    const months = birthdaysByMonth([person("1", "Ana", "2000-03-03")], today);
    expect(months[2].entries[0].turningAge).toBe(27);
  });
});

describe("upcomingBirthdays", () => {
  it("orders by how soon, today first", () => {
    const upcoming = upcomingBirthdays(
      [
        person("1", "In ten days", "2001-08-16"),
        person("2", "Today", "2001-08-06"),
        person("3", "Tomorrow", "2001-08-07"),
      ],
      today,
    );
    expect(upcoming.map((entry) => entry.person.fullName)).toEqual([
      "Today",
      "Tomorrow",
      "In ten days",
    ]);
  });

  it("stops at the window", () => {
    const upcoming = upcomingBirthdays([person("1", "Far off", "2001-11-30")], today, 30);
    expect(upcoming).toEqual([]);
  });
});

describe("birthdayCountdownLabel", () => {
  it("reads the way someone would say it", () => {
    expect(birthdayCountdownLabel(0)).toBe("Today");
    expect(birthdayCountdownLabel(1)).toBe("Tomorrow");
    expect(birthdayCountdownLabel(3)).toBe("In 3 days");
    expect(birthdayCountdownLabel(10)).toBe("Next week");
    expect(birthdayCountdownLabel(28)).toBe("In 4 weeks");
  });
});
