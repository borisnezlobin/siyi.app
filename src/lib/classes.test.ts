import { describe, expect, it } from "vitest";
import {
  classMatchesQuery,
  courseOptions,
  formatDays,
  formatTimeRange,
  minutesInto,
  normalizeCourseCode,
  parseDays,
  personMatchesClassQuery,
  scheduleForDay,
  type PersonClass,
} from "@/lib/classes";

const entry = (overrides: Partial<PersonClass> = {}): PersonClass => ({
  id: "class-1",
  personId: "person-1",
  courseCode: "DATA 8",
  courseTitle: "Foundations of Data Science",
  professor: "DeNero",
  term: "Fall 2026",
  days: "MWF",
  startsAt: "10:00",
  endsAt: "11:00",
  location: "Wheeler 150",
  ...overrides,
});

describe("parseDays", () => {
  it("reads two-letter days before the letters that start them", () => {
    expect(parseDays("TuTh")).toEqual(["Tu", "Th"]);
    expect(parseDays("MWF")).toEqual(["M", "W", "F"]);
    expect(parseDays("MTuWThF")).toEqual(["M", "Tu", "W", "Th", "F"]);
  });

  it("ignores separators and repeats", () => {
    expect(parseDays("M/W/F")).toEqual(["M", "W", "F"]);
    expect(parseDays("MM")).toEqual(["M"]);
  });

  it("returns nothing when there is nothing", () => {
    expect(parseDays(null)).toEqual([]);
    expect(parseDays("")).toEqual([]);
  });

  it("round-trips through formatDays in week order", () => {
    expect(formatDays(parseDays("FM"))).toBe("MF");
  });
});

describe("normalizeCourseCode", () => {
  it("treats the ways people write a code as one course", () => {
    expect(normalizeCourseCode("cs 61a")).toBe("CS 61A");
    expect(normalizeCourseCode("CS61A")).toBe("CS61A");
    expect(normalizeCourseCode(" cs-61a ")).toBe("CS 61A");
  });
});

describe("classMatchesQuery", () => {
  it("finds a class by code, title or professor", () => {
    expect(classMatchesQuery(entry(), "data 8")).toBe(true);
    expect(classMatchesQuery(entry(), "denero")).toBe(true);
    expect(classMatchesQuery(entry(), "foundations")).toBe(true);
  });

  it("requires every word, so a course and a professor can be named together", () => {
    expect(classMatchesQuery(entry(), "data 8 denero")).toBe(true);
    expect(classMatchesQuery(entry(), "data 8 hilfinger")).toBe(false);
  });

  it("treats an empty query as everything", () => {
    expect(classMatchesQuery(entry(), "  ")).toBe(true);
  });
});

describe("personMatchesClassQuery", () => {
  it("is true when any of their classes matches", () => {
    const classes = [entry(), entry({ id: "class-2", courseCode: "CS 61A" })];
    expect(personMatchesClassQuery(classes, "cs 61a")).toBe(true);
    expect(personMatchesClassQuery(classes, "physics")).toBe(false);
    expect(personMatchesClassQuery([], "cs 61a")).toBe(false);
  });
});

describe("courseOptions", () => {
  it("counts each course once, most common first", () => {
    const options = courseOptions([
      entry(),
      entry({ id: "b", courseCode: "cs 61a", courseTitle: "Structure and Interpretation" }),
      entry({ id: "c", courseCode: "CS61A" }),
      entry({ id: "d", courseCode: "DATA 8" }),
    ]);

    expect(options[0]).toEqual({ code: "DATA 8", title: "Foundations of Data Science", count: 2 });
    expect(options.map((option) => option.code)).toContain("CS 61A");
  });
});

describe("times", () => {
  it("converts to minutes and refuses nonsense", () => {
    expect(minutesInto("10:30")).toBe(630);
    expect(minutesInto("09:05")).toBe(545);
    expect(minutesInto("99:99")).toBeNull();
    expect(minutesInto(null)).toBeNull();
  });

  it("reads a range the way it would be said", () => {
    expect(formatTimeRange("10:00", "11:00")).toBe("10am–11am");
    expect(formatTimeRange("13:30", "14:45")).toBe("1:30pm–2:45pm");
    expect(formatTimeRange("12:00", null)).toBe("12pm");
    expect(formatTimeRange(null, null)).toBeNull();
  });
});

describe("scheduleForDay", () => {
  const people = [
    { id: "1", name: "Ana", classes: [entry({ startsAt: "14:00", endsAt: "15:00" })] },
    { id: "2", name: "Ben", classes: [entry({ id: "b", startsAt: "09:00", endsAt: "10:00" })] },
    { id: "3", name: "Cal", classes: [entry({ id: "c", days: "TuTh" })] },
  ];

  it("returns only that day, in time order", () => {
    const monday = scheduleForDay(people, "M");
    expect(monday.map((slot) => slot.personName)).toEqual(["Ben", "Ana"]);
  });

  it("places a class on each of its days", () => {
    expect(scheduleForDay(people, "Tu").map((slot) => slot.personName)).toEqual(["Cal"]);
  });

  it("leaves out a class with no start time rather than putting it at midnight", () => {
    const untimed = [{ id: "1", name: "Ana", classes: [entry({ startsAt: null })] }];
    expect(scheduleForDay(untimed, "M")).toEqual([]);
  });

  it("gives a class with no end time a sensible length", () => {
    const open = [{ id: "1", name: "Ana", classes: [entry({ endsAt: null })] }];
    expect(scheduleForDay(open, "M")[0].endsAt).toBe(650);
  });
});
