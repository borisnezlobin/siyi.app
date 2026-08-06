import { describe, expect, it } from "vitest";
import {
  isMissingNoteSchema,
  maxNoteBodyLength,
  maxNoteHeadingLength,
  moveNoteSection,
  nextNotePosition,
  normalizeNoteHeading,
  orderedNoteSections,
  suggestedNoteHeadings,
} from "@/lib/note-sections";
import {
  personNoteEditSchema,
  personNoteInputSchema,
  personNoteOrderSchema,
} from "@/lib/validation";

function section(
  id: string,
  position: number,
  createdAt = "2026-01-01T00:00:00.000Z",
) {
  return { id, position, createdAt };
}

describe("orderedNoteSections", () => {
  it("orders by position", () => {
    const ordered = orderedNoteSections([
      section("c", 2),
      section("a", 0),
      section("b", 1),
    ]);
    expect(ordered.map((entry) => entry.id)).toEqual(["a", "b", "c"]);
  });

  it("falls back to creation order when positions collide", () => {
    const ordered = orderedNoteSections([
      section("newer", 0, "2026-03-01T00:00:00.000Z"),
      section("older", 0, "2026-02-01T00:00:00.000Z"),
    ]);
    expect(ordered.map((entry) => entry.id)).toEqual(["older", "newer"]);
  });

  it("leaves the input array untouched", () => {
    const sections = [section("b", 1), section("a", 0)];
    orderedNoteSections(sections);
    expect(sections.map((entry) => entry.id)).toEqual(["b", "a"]);
  });
});

describe("nextNotePosition", () => {
  it("starts at zero", () => {
    expect(nextNotePosition([])).toBe(0);
  });

  it("goes one past the highest position, gaps and all", () => {
    expect(nextNotePosition([{ position: 0 }, { position: 7 }])).toBe(8);
  });
});

describe("moveNoteSection", () => {
  const sections = [section("a", 0), section("b", 1), section("c", 2)];

  it("moves a section up and renumbers everything", () => {
    const moved = moveNoteSection(sections, "c", "up");
    expect(moved.map((entry) => entry.id)).toEqual(["a", "c", "b"]);
    expect(moved.map((entry) => entry.position)).toEqual([0, 1, 2]);
  });

  it("moves a section down", () => {
    const moved = moveNoteSection(sections, "a", "down");
    expect(moved.map((entry) => entry.id)).toEqual(["b", "a", "c"]);
  });

  it("keeps the order when there is nowhere to go", () => {
    expect(moveNoteSection(sections, "a", "up").map((entry) => entry.id)).toEqual(
      ["a", "b", "c"],
    );
    expect(
      moveNoteSection(sections, "c", "down").map((entry) => entry.id),
    ).toEqual(["a", "b", "c"]);
  });

  it("closes gaps in saved positions even when nothing moves", () => {
    const gapped = [section("a", 3), section("b", 9)];
    expect(moveNoteSection(gapped, "a", "up").map((entry) => entry.position)).toEqual(
      [0, 1],
    );
  });

  it("ignores an id that is not there", () => {
    expect(
      moveNoteSection(sections, "missing", "up").map((entry) => entry.id),
    ).toEqual(["a", "b", "c"]);
  });
});

describe("normalizeNoteHeading", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeNoteHeading("  Things   we did  ")).toBe("Things we did");
  });
});

describe("suggestedNoteHeadings", () => {
  it("offers headings from other people", () => {
    expect(
      suggestedNoteHeadings({
        previouslyUsed: ["Interests", "Things mentioned"],
        alreadyOnThisPerson: [],
      }),
    ).toEqual(["Interests", "Things mentioned"]);
  });

  it("drops headings this person already has, ignoring case and spacing", () => {
    expect(
      suggestedNoteHeadings({
        previouslyUsed: ["Interests", "Things mentioned"],
        alreadyOnThisPerson: ["  interests "],
      }),
    ).toEqual(["Things mentioned"]);
  });

  it("de-duplicates repeats and keeps the first spelling", () => {
    expect(
      suggestedNoteHeadings({
        previouslyUsed: ["Interests", "INTERESTS", "interests"],
        alreadyOnThisPerson: [],
      }),
    ).toEqual(["Interests"]);
  });

  it("skips blank headings and respects the limit", () => {
    expect(
      suggestedNoteHeadings({
        previouslyUsed: ["   ", "One", "Two", "Three"],
        alreadyOnThisPerson: [],
        limit: 2,
      }),
    ).toEqual(["One", "Two"]);
  });
});

describe("isMissingNoteSchema", () => {
  it("recognises the codes a pending migration produces", () => {
    expect(isMissingNoteSchema("42P01")).toBe(true);
    expect(isMissingNoteSchema("PGRST205")).toBe(true);
    expect(isMissingNoteSchema("23505")).toBe(false);
    expect(isMissingNoteSchema(undefined)).toBe(false);
  });
});

const personId = "5b2f0f5a-4c8f-4d2a-9c4a-2c1a0d5f9b11";

describe("person note validation", () => {
  it("normalizes the heading and defaults the body", () => {
    const parsed = personNoteInputSchema.parse({
      personId,
      heading: "  Things   mentioned ",
    });
    expect(parsed).toEqual({ personId, heading: "Things mentioned", body: "" });
  });

  it("rejects an empty heading", () => {
    expect(
      personNoteEditSchema.safeParse({ heading: "   ", body: "" }).success,
    ).toBe(false);
  });

  it("rejects a heading past the limit but accepts one at it", () => {
    expect(
      personNoteEditSchema.safeParse({
        heading: "a".repeat(maxNoteHeadingLength),
        body: "",
      }).success,
    ).toBe(true);
    expect(
      personNoteEditSchema.safeParse({
        heading: "a".repeat(maxNoteHeadingLength + 1),
        body: "",
      }).success,
    ).toBe(false);
  });

  it("rejects a body past the limit but accepts one at it", () => {
    expect(
      personNoteEditSchema.safeParse({
        heading: "Interests",
        body: "a".repeat(maxNoteBodyLength),
      }).success,
    ).toBe(true);
    expect(
      personNoteEditSchema.safeParse({
        heading: "Interests",
        body: "a".repeat(maxNoteBodyLength + 1),
      }).success,
    ).toBe(false);
  });

  it("needs at least one note id to reorder", () => {
    expect(
      personNoteOrderSchema.safeParse({ personId, noteIds: [] }).success,
    ).toBe(false);
    expect(
      personNoteOrderSchema.safeParse({ personId, noteIds: [personId] }).success,
    ).toBe(true);
  });
});
