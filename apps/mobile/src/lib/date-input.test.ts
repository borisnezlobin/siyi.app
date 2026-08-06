import {
  dateFromDateInput,
  dateInputLabel,
  daysAgoDateInputValue,
  isFutureDateInput,
  isValidDateInput,
  parseDateInput,
  timestampFromDateInput,
  toDateInputValue,
  todayDateInputValue,
} from "@/lib/date-input";

const now = new Date("2026-08-06T15:30:00");

describe("parseDateInput", () => {
  it("reads the format the fields store", () => {
    expect(parseDateInput("2004-03-18")).toBe("2004-03-18");
  });

  it("reads unpadded numbers", () => {
    expect(parseDateInput("2004-3-8")).toBe("2004-03-08");
  });

  it("reads a numeric date month-first when either number could be a month", () => {
    expect(parseDateInput("03/18/2004")).toBe("2004-03-18");
    expect(parseDateInput("03/04/2004")).toBe("2004-03-04");
  });

  it("reads a numeric date day-first when the first number cannot be a month", () => {
    expect(parseDateInput("18/03/2004")).toBe("2004-03-18");
  });

  it("reads written-out months either way round", () => {
    expect(parseDateInput("March 18 2004")).toBe("2004-03-18");
    expect(parseDateInput("18 March 2004")).toBe("2004-03-18");
    expect(parseDateInput("Mar 18, 2004")).toBe("2004-03-18");
    expect(parseDateInput("18th Sept 2004")).toBe("2004-09-18");
  });

  it("shrugs off whitespace and stray punctuation", () => {
    expect(parseDateInput("  2004-03-18.  ")).toBe("2004-03-18");
    expect(parseDateInput("2004 . 03 . 18")).toBe("2004-03-18");
    expect(parseDateInput("18 - 03 - 2004")).toBe("2004-03-18");
    expect(parseDateInput("march   18,   2004")).toBe("2004-03-18");
  });

  it("refuses anything it would have to guess at", () => {
    expect(parseDateInput("")).toBeNull();
    expect(parseDateInput("   ")).toBeNull();
    expect(parseDateInput(null)).toBeNull();
    expect(parseDateInput("nonsense")).toBeNull();
    expect(parseDateInput("2004-02-31")).toBeNull();
    expect(parseDateInput("2003-02-29")).toBeNull();
    expect(parseDateInput("2004-13-01")).toBeNull();
    expect(parseDateInput("2004-00-10")).toBeNull();
    expect(parseDateInput("18/19/2004")).toBeNull();
    expect(parseDateInput("Marchtember 18 2004")).toBeNull();
    expect(parseDateInput("18 March")).toBeNull();
    expect(parseDateInput("03/18/04")).toBeNull();
    expect(parseDateInput("6 Aug")).toBeNull();
  });

  it("keeps the real leap day", () => {
    expect(parseDateInput("2004-02-29")).toBe("2004-02-29");
    expect(parseDateInput("2000-02-29")).toBe("2000-02-29");
    expect(parseDateInput("1900-02-29")).toBeNull();
  });
});

describe("dateInputLabel", () => {
  it("spells the month out so the reading is unmistakable", () => {
    expect(dateInputLabel("03/04/2004")).toBe("March 4, 2004");
    expect(dateInputLabel("18 March 2004")).toBe("March 18, 2004");
    expect(dateInputLabel("nonsense")).toBe("");
  });

  it("names the same day whatever the local clock says", () => {
    const date = dateFromDateInput("2004-03-18");

    expect(date?.getFullYear()).toBe(2004);
    expect(date?.getMonth()).toBe(2);
    expect(date?.getDate()).toBe(18);
    expect(date?.getHours()).toBe(12);
  });
});

describe("date input helpers", () => {
  it("recognizes real calendar dates in any readable shape", () => {
    expect(isValidDateInput("2026-08-06")).toBe(true);
    expect(isValidDateInput("06/08/2026")).toBe(true);
    expect(isValidDateInput("2026-02-31")).toBe(false);
    expect(isValidDateInput("6 Aug")).toBe(false);
    expect(isValidDateInput("")).toBe(false);
  });

  it("treats tomorrow as a future date and today as not", () => {
    expect(isFutureDateInput("2026-08-07", now)).toBe(true);
    expect(isFutureDateInput(todayDateInputValue(now), now)).toBe(false);
    expect(isFutureDateInput("August 7 2026", now)).toBe(true);
  });

  it("counts back whole days", () => {
    expect(daysAgoDateInputValue(1, now)).toBe("2026-08-05");
    expect(daysAgoDateInputValue(7, now)).toBe("2026-07-30");
  });

  it("keeps the current time when the chosen day is today", () => {
    expect(timestampFromDateInput("2026-08-06", now)).toBe(now.toISOString());
    expect(timestampFromDateInput("August 6, 2026", now)).toBe(
      now.toISOString(),
    );
  });

  it("places a backdated day at midday", () => {
    const backdated = new Date(timestampFromDateInput("2026-07-04", now));

    expect(toDateInputValue(backdated.toISOString())).toBe("2026-07-04");
    expect(backdated.getHours()).toBe(12);
  });

  it("keeps a date typed near midnight on the day that was typed", () => {
    const lateNight = new Date("2026-08-06T23:58:00");
    const stored = timestampFromDateInput("2026-07-04", lateNight);

    expect(toDateInputValue(stored)).toBe("2026-07-04");
    expect(parseDateInput("4 July 2026")).toBe("2026-07-04");
  });

  it("falls back to now when the value is unusable", () => {
    expect(timestampFromDateInput("later", now)).toBe(now.toISOString());
  });

  it("reads a stored timestamp back into a date field", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue("not a date")).toBe("");
  });
});
