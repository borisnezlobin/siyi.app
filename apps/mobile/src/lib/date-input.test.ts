import {
  daysAgoDateInputValue,
  isFutureDateInput,
  isValidDateInput,
  timestampFromDateInput,
  toDateInputValue,
  todayDateInputValue,
} from "@/lib/date-input";

const now = new Date("2026-08-06T15:30:00");

describe("date input helpers", () => {
  it("recognizes only real calendar dates", () => {
    expect(isValidDateInput("2026-08-06")).toBe(true);
    expect(isValidDateInput("2026-02-31")).toBe(false);
    expect(isValidDateInput("6 Aug")).toBe(false);
    expect(isValidDateInput("")).toBe(false);
  });

  it("treats tomorrow as a future date and today as not", () => {
    expect(isFutureDateInput("2026-08-07", now)).toBe(true);
    expect(isFutureDateInput(todayDateInputValue(now), now)).toBe(false);
  });

  it("counts back whole days", () => {
    expect(daysAgoDateInputValue(1, now)).toBe("2026-08-05");
    expect(daysAgoDateInputValue(7, now)).toBe("2026-07-30");
  });

  it("keeps the current time when the chosen day is today", () => {
    expect(timestampFromDateInput("2026-08-06", now)).toBe(now.toISOString());
  });

  it("places a backdated day at midday", () => {
    const backdated = new Date(timestampFromDateInput("2026-07-04", now));

    expect(toDateInputValue(backdated.toISOString())).toBe("2026-07-04");
    expect(backdated.getHours()).toBe(12);
  });

  it("falls back to now when the value is unusable", () => {
    expect(timestampFromDateInput("later", now)).toBe(now.toISOString());
  });

  it("reads a stored timestamp back into a date field", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue("not a date")).toBe("");
  });
});
