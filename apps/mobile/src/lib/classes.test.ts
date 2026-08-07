import {
  classMatchesQuery,
  courseOptions,
  formatDays,
  normalizeCourseCode,
  parseDays,
  peopleByCourse,
  personMatchesClassQuery,
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
    expect(normalizeCourseCode("CS61A")).toBe("CS 61A");
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

    expect(options.find((option) => option.code === "DATA 8")).toEqual({
      code: "DATA 8",
      title: "Foundations of Data Science",
      count: 2,
    });
    // CS61A and "cs 61a" are the same course, so they are counted once.
    expect(options.filter((option) => option.code === "CS 61A")).toHaveLength(1);
    expect(options.map((option) => option.code)).toContain("CS 61A");
  });
});

describe("peopleByCourse", () => {
  const people = [
    { id: "1", name: "Ana", classes: [entry()] },
    { id: "2", name: "Ben", classes: [entry({ id: "b", courseCode: "cs 61a", professor: "Hilfinger" })] },
    { id: "3", name: "Cal", classes: [entry({ id: "c" }), entry({ id: "d", courseCode: "CS61A" })] },
  ];

  it("groups everyone by course", () => {
    const groups = peopleByCourse(people);
    const data = groups.find((group) => group.code === "DATA 8");
    expect(data?.people.map((person) => person.name)).toEqual(["Ana", "Cal"]);
  });

  it("puts the course with the most people first", () => {
    const groups = peopleByCourse([
      ...people,
      { id: "4", name: "Dee", classes: [entry({ id: "e" })] },
    ]);
    expect(groups[0].code).toBe("DATA 8");
  });

  it("treats the ways a code is written as one course", () => {
    const groups = peopleByCourse(people);
    const cs = groups.find((group) => group.code === "CS 61A");
    expect(cs?.people).toHaveLength(2);
  });

  it("collects the professors named for a course", () => {
    const groups = peopleByCourse(people);
    expect(groups.find((group) => group.code === "DATA 8")?.professors).toEqual([
      "DeNero",
    ]);
  });

  it("lists a person once even with two rows for the same course", () => {
    const groups = peopleByCourse([
      { id: "1", name: "Ana", classes: [entry(), entry({ id: "b" })] },
    ]);
    expect(groups[0].people).toHaveLength(1);
  });

  it("returns nothing when nobody has a class", () => {
    expect(peopleByCourse([{ id: "1", name: "Ana", classes: [] }])).toEqual([]);
  });
});
