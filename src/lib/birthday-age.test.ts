import { describe, expect, it } from "vitest";
import { ageAtNextBirthday, ageOnDate } from "@/lib/birthday-age";

const today = new Date("2026-08-06T09:00:00");

describe("age from a birthday", () => {
  it("counts a birthday earlier this year as already had", () => {
    expect(ageOnDate("2005-03-18", today)).toBe(21);
  });

  it("does not count a birthday still to come this year", () => {
    expect(ageOnDate("2005-11-02", today)).toBe(20);
  });

  it("counts the birthday itself as the day they turn", () => {
    expect(ageOnDate("2005-08-06", today)).toBe(21);
    expect(ageAtNextBirthday("2005-08-06", today)).toBe(21);
  });

  it("handles a leap-day birthday on either side of the date", () => {
    expect(ageOnDate("2004-02-29", new Date("2027-02-28T09:00:00"))).toBe(22);
    expect(ageOnDate("2004-02-29", new Date("2027-03-01T09:00:00"))).toBe(23);
  });

  it("gives no age when the stored year is a placeholder", () => {
    expect(ageOnDate("1900-04-18", today)).toBeNull();
    expect(ageOnDate("0001-04-18", today)).toBeNull();
    expect(ageAtNextBirthday("1900-04-18", today)).toBeNull();
  });

  it("gives no age for an implausible or missing birthday", () => {
    expect(ageOnDate("2027-01-04", today)).toBeNull();
    expect(ageOnDate(null, today)).toBeNull();
    expect(ageOnDate("", today)).toBeNull();
    expect(ageOnDate("not-a-date", today)).toBeNull();
  });

  it("reports the age they are about to turn", () => {
    expect(ageAtNextBirthday("2005-08-09", today)).toBe(21);
    expect(ageAtNextBirthday("2005-03-18", today)).toBe(22);
  });

  it("stays on the stored day whatever the time of day", () => {
    expect(ageOnDate("2005-08-06", new Date("2026-08-06T23:30:00"))).toBe(21);
    expect(ageOnDate("2005-08-06", new Date("2026-08-05T23:30:00"))).toBe(20);
  });
});
