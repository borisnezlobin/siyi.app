import {
  checkInCandidates,
  lastSeenLabel,
  loggedToday,
  shouldAskToday,
} from "@/lib/daily-check-in";

const today = new Date(2026, 7, 6, 18, 0, 0);
const daysAgo = (days: number) =>
  new Date(today.getTime() - days * 86_400_000).toISOString();

const person = (id: string, fullName: string, lastInteractionAt: string | null) => ({
  id,
  fullName,
  lastInteractionAt,
});

describe("loggedToday", () => {
  it("is true only for something logged today", () => {
    expect(loggedToday(person("1", "Ana", daysAgo(0)), today)).toBe(true);
    expect(loggedToday(person("2", "Ben", daysAgo(1)), today)).toBe(false);
    expect(loggedToday(person("3", "Cal", null), today)).toBe(false);
  });
});

describe("checkInCandidates", () => {
  it("offers the people seen most recently first", () => {
    const candidates = checkInCandidates(
      [
        person("1", "Months ago", daysAgo(90)),
        person("2", "Yesterday", daysAgo(1)),
        person("3", "Last week", daysAgo(6)),
      ],
      today,
    );
    expect(candidates.map((entry) => entry.fullName)).toEqual([
      "Yesterday",
      "Last week",
      "Months ago",
    ]);
  });

  it("leaves out anyone already logged today", () => {
    const candidates = checkInCandidates(
      [person("1", "Done", daysAgo(0)), person("2", "Still open", daysAgo(3))],
      today,
    );
    expect(candidates.map((entry) => entry.fullName)).toEqual(["Still open"]);
  });

  it("leaves out archived people", () => {
    const candidates = checkInCandidates(
      [{ ...person("1", "Archived", daysAgo(2)), status: "archived" }],
      today,
    );
    expect(candidates).toEqual([]);
  });

  it("falls back to when you met someone never logged", () => {
    const candidates = checkInCandidates(
      [
        { ...person("1", "Old friend", null), firstMetAt: daysAgo(200) },
        { ...person("2", "Just met", null), firstMetAt: daysAgo(1) },
      ],
      today,
    );
    expect(candidates.map((entry) => entry.fullName)).toEqual([
      "Just met",
      "Old friend",
    ]);
  });

  it("caps how many it asks about", () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      person(String(index), `Person ${index}`, daysAgo(index + 1)),
    );
    expect(checkInCandidates(many, today)).toHaveLength(12);
  });
});

describe("shouldAskToday", () => {
  it("stays quiet with nobody to ask about", () => {
    expect(shouldAskToday([], today)).toBe(false);
    expect(shouldAskToday([person("1", "Done", daysAgo(0))], today)).toBe(false);
  });

  it("asks when someone is still unlogged", () => {
    expect(shouldAskToday([person("1", "Open", daysAgo(4))], today)).toBe(true);
  });
});

describe("lastSeenLabel", () => {
  it("reads the way someone would say it", () => {
    expect(lastSeenLabel(person("1", "A", null), today)).toBe("Not logged yet");
    expect(lastSeenLabel(person("2", "B", daysAgo(1)), today)).toBe("Yesterday");
    expect(lastSeenLabel(person("3", "C", daysAgo(3)), today)).toBe("3 days ago");
    expect(lastSeenLabel(person("4", "D", daysAgo(10)), today)).toBe("Last week");
    expect(lastSeenLabel(person("5", "E", daysAgo(90)), today)).toBe("3 months ago");
  });
});
