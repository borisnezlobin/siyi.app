import {
  isMissingNoteSchema,
  moveNoteSection,
  nextNotePosition,
  normalizeNoteHeading,
  orderedNoteSections,
  suggestedNoteHeadings,
} from "@/lib/note-sections";
import type { PersonNote } from "@/lib/types";

function note(
  id: string,
  position: number,
  overrides: Partial<PersonNote> = {},
): PersonNote {
  return {
    id,
    personId: "person-1",
    userId: "user-1",
    heading: id,
    body: "",
    position,
    createdAt: "2026-08-01T12:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("note section ordering", () => {
  it("sorts by position, then by when it was written", () => {
    const sections = [
      note("c", 1, { createdAt: "2026-08-02T12:00:00.000Z" }),
      note("a", 0),
      note("b", 1, { createdAt: "2026-08-01T09:00:00.000Z" }),
    ];

    expect(orderedNoteSections(sections).map(({ id }) => id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("settles ties on the same position and time by id, so the order never flickers", () => {
    const sections = [note("b", 0), note("a", 0)];
    expect(orderedNoteSections(sections).map(({ id }) => id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("puts a new section after everything already there", () => {
    expect(nextNotePosition([])).toBe(0);
    expect(nextNotePosition([note("a", 0), note("b", 3)])).toBe(4);
  });
});

describe("reordering note sections", () => {
  const sections = [note("a", 0), note("b", 1), note("c", 2)];

  it("moves one section up and renumbers the whole list from zero", () => {
    const moved = moveNoteSection(sections, "c", "up");
    expect(moved.map(({ id, position }) => [id, position])).toEqual([
      ["a", 0],
      ["c", 1],
      ["b", 2],
    ]);
  });

  it("moves one section down", () => {
    const moved = moveNoteSection(sections, "a", "down");
    expect(moved.map(({ id }) => id)).toEqual(["b", "a", "c"]);
  });

  it("leaves the list alone at either end", () => {
    expect(moveNoteSection(sections, "a", "up").map(({ id }) => id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(moveNoteSection(sections, "c", "down").map(({ id }) => id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("renumbers positions that had drifted apart", () => {
    const drifted = [note("a", 0), note("b", 7), note("c", 9)];
    expect(moveNoteSection(drifted, "b", "down").map((s) => s.position)).toEqual(
      [0, 1, 2],
    );
  });
});

describe("heading suggestions", () => {
  it("offers headings used on other people and skips the ones already here", () => {
    expect(
      suggestedNoteHeadings({
        previouslyUsed: ["Interests", "Family", "Food"],
        alreadyOnThisPerson: ["Family"],
      }),
    ).toEqual(["Interests", "Food"]);
  });

  it("treats spacing and case as the same heading", () => {
    expect(
      suggestedNoteHeadings({
        previouslyUsed: ["  Interests ", "interests", "Things   we did"],
        alreadyOnThisPerson: [],
      }),
    ).toEqual(["Interests", "Things we did"]);

    expect(
      suggestedNoteHeadings({
        previouslyUsed: ["INTERESTS"],
        alreadyOnThisPerson: [" interests "],
      }),
    ).toEqual([]);
  });

  it("drops blank headings and stops at the limit", () => {
    expect(
      suggestedNoteHeadings({
        previouslyUsed: ["  ", "One", "Two", "Three"],
        alreadyOnThisPerson: [],
        limit: 2,
      }),
    ).toEqual(["One", "Two"]);
  });
});

describe("pre-migration tolerance", () => {
  it("treats a missing table or column as the feature not being switched on", () => {
    for (const code of ["42P01", "42883", "42703", "PGRST202", "PGRST205"]) {
      expect(isMissingNoteSchema(code)).toBe(true);
    }
    expect(isMissingNoteSchema("23505")).toBe(false);
    expect(isMissingNoteSchema(undefined)).toBe(false);
  });

  it("normalises headings the same way the server does", () => {
    expect(normalizeNoteHeading("  Things   we did ")).toBe("Things we did");
  });
});
