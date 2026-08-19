import {
  alreadyLoggedIds,
  checkInCandidates,
  keepCheckInOrder,
  startOfCheckInDay,
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

  it("keeps anyone already logged today on the list, so they stay ticked", () => {
    const candidates = checkInCandidates(
      [person("1", "Done", daysAgo(0)), person("2", "Still open", daysAgo(3))],
      today,
    );
    expect(candidates.map((entry) => entry.fullName)).toEqual(["Done", "Still open"]);
    expect(alreadyLoggedIds(candidates, today)).toEqual(["1"]);
  });

  it("treats the day as ending at 4am, not midnight", () => {
    const oneAm = new Date(2026, 7, 7, 1, 0, 0);
    const lastNight = new Date(2026, 7, 6, 23, 0, 0).toISOString();
    expect(alreadyLoggedIds([person("1", "Party", lastNight)], oneAm)).toEqual(["1"]);
    expect(startOfCheckInDay(oneAm).getDate()).toBe(6);

    const nineAm = new Date(2026, 7, 7, 9, 0, 0);
    expect(alreadyLoggedIds([person("1", "Party", lastNight)], nineAm)).toEqual([]);
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

  it("offers everyone, because a hidden cap is what broke this screen", () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      person(String(index), `Person ${index}`, daysAgo(index + 1)),
    );
    expect(checkInCandidates(many, today)).toHaveLength(30);
  });
});

/**
 * The three things that were reported, as three tests. All of them were the one
 * cap: it was applied after the "not logged today" filter, and ticking somebody
 * changes which side of that filter they are on.
 */
describe("the roster does not move while you are reading it", () => {
  const many = Array.from({ length: 30 }, (_, index) =>
    person(String(index), `Person ${index}`, daysAgo(index + 1)),
  );
  const roster = (people: ReturnType<typeof person>[]) =>
    checkInCandidates(people, today).map((entry) => entry.id);
  const tick = (people: ReturnType<typeof person>[], ids: string[]) =>
    people.map((entry) =>
      ids.includes(entry.id)
        ? { ...entry, lastInteractionAt: today.toISOString() }
        : entry,
    );

  it("shows nobody new when you tick somebody", () => {
    // Ticking used to move a person out of the capped group, free a place, and
    // admit a stranger who had never been on the page.
    expect(roster(tick(many, ["5"])).sort()).toEqual(roster(many).sort());
  });

  it("takes nobody away when you tick and then untick", () => {
    const ticked = roster(tick(many, ["5"]));
    const untickedAgain = roster(many);
    expect(untickedAgain.sort()).toEqual(ticked.sort());
  });

  it("keeps everybody when somebody is seen from another screen", () => {
    // A last-seen changing elsewhere used to push whoever sat at the bottom off
    // the list, and everything below them jumped up.
    const seenElsewhere = many.map((entry) =>
      entry.id === "29" ? { ...entry, lastInteractionAt: daysAgo(0.5) } : entry,
    );
    expect(roster(seenElsewhere).sort()).toEqual(roster(many).sort());
  });

  it("holds the opening order even after somebody is ticked", () => {
    const opening = roster(many);
    const after = keepCheckInOrder(checkInCandidates(tick(many, ["5"]), today), opening);
    expect(after.map((entry) => entry.id)).toEqual(opening);
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


describe("keepCheckInOrder", () => {
  const person = (id: string) => ({ id, fullName: id });

  it("keeps the order the page opened with, however the answer re-sorts", () => {
    const resorted = [person("c"), person("a"), person("b")];

    expect(
      keepCheckInOrder(resorted, ["a", "b", "c"]).map((entry) => entry.id)
    ).toEqual(["a", "b", "c"]);
  });

  it("puts anyone who turns up later at the end, in the order given", () => {
    const kept = keepCheckInOrder(
      [person("new"), person("b"), person("later"), person("a")],
      ["a", "b"]
    );

    expect(kept.map((entry) => entry.id)).toEqual(["a", "b", "new", "later"]);
  });
});
