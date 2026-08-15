import { describe, expect, it } from "vitest";

import {
  groupResultsByPerson,
  isSearchUnavailable,
  mapSearchResults,
  snippetAround,
  type SearchResult,
  type SearchResultRow,
} from "@/lib/search";

function row(overrides: Partial<SearchResultRow> = {}): SearchResultRow {
  return {
    kind: "update",
    record_id: "update-1",
    person_ids: ["person-1"],
    title: null,
    snippet: "She is moving to Boston in September.",
    occurred_at: "2026-08-01T00:00:00.000Z",
    rank: 0.5,
    ...overrides,
  };
}

function result(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    kind: "update",
    recordId: "update-1",
    personIds: ["person-1"],
    title: null,
    snippet: "She is moving to Boston in September.",
    occurredAt: "2026-08-01T00:00:00.000Z",
    rank: 0.5,
    ...overrides,
  };
}

describe("mapSearchResults", () => {
  it("names the database columns the way the rest of the app spells them", () => {
    expect(mapSearchResults([row()])).toEqual([
      {
        kind: "update",
        recordId: "update-1",
        personIds: ["person-1"],
        title: null,
        snippet: "She is moving to Boston in September.",
        occurredAt: "2026-08-01T00:00:00.000Z",
        rank: 0.5,
      },
    ]);
  });

  it("reads no rows at all as no results rather than failing", () => {
    expect(mapSearchResults(null)).toEqual([]);
  });

  it("drops a row whose kind it does not know, so nothing links nowhere", () => {
    expect(mapSearchResults([row({ kind: "voicememo" })])).toEqual([]);
  });

  it("drops a row with no record id", () => {
    expect(mapSearchResults([row({ record_id: null })])).toEqual([]);
  });

  it("keeps the rows it understands when one alongside them is unknown", () => {
    const results = mapSearchResults([row(), row({ kind: "voicememo", record_id: "x" })]);
    expect(results.map((entry) => entry.recordId)).toEqual(["update-1"]);
  });

  it("treats a result about nobody as having no people, not null", () => {
    expect(mapSearchResults([row({ person_ids: null })])[0]?.personIds).toEqual([]);
  });

  it("treats a blank title or snippet as absent so nothing renders an empty line", () => {
    const [mapped] = mapSearchResults([row({ title: "   ", snippet: "" })]);
    expect(mapped?.title).toBeNull();
    expect(mapped?.snippet).toBeNull();
  });
});

describe("isSearchUnavailable", () => {
  it("recognises the function missing because migration 0028 has not run", () => {
    expect(isSearchUnavailable({ code: "42883" })).toBe(true);
  });

  it("recognises PostgREST failing to find the function in its schema cache", () => {
    expect(isSearchUnavailable({ code: "PGRST202" })).toBe(true);
  });

  it("recognises a table the function reads being absent", () => {
    expect(isSearchUnavailable({ code: "42P01" })).toBe(true);
  });

  it("does not swallow an unrelated database error", () => {
    expect(isSearchUnavailable({ code: "23505" })).toBe(false);
  });

  it("reads no error as the search having worked", () => {
    expect(isSearchUnavailable(null)).toBe(false);
  });
});

describe("snippetAround", () => {
  it("returns short text whole, with no ellipsis", () => {
    expect(snippetAround("Met at the climbing gym.", "climbing")).toBe("Met at the climbing gym.");
  });

  it("collapses the whitespace a textarea leaves behind", () => {
    expect(snippetAround("Met   at\n\nthe gym.", "gym")).toBe("Met at the gym.");
  });

  it("keeps the window around the word that matched, not the start of the text", () => {
    const text = `${"a ".repeat(200)}climbing gym${" b".repeat(200)}`;
    const snippet = snippetAround(text, "climbing");
    expect(snippet).toContain("climbing gym");
  });

  it("marks both ends it cut", () => {
    const text = `${"a ".repeat(200)}climbing gym${" b".repeat(200)}`;
    const snippet = snippetAround(text, "climbing");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("does not open with an ellipsis when the match is already at the start", () => {
    const snippet = snippetAround(`climbing gym${" b".repeat(200)}`, "climbing");
    expect(snippet.startsWith("…")).toBe(false);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("falls back to the opening when stemming matched a word it cannot find", () => {
    const text = `She is moving to Boston.${" trailing".repeat(60)}`;
    const snippet = snippetAround(text, "move");
    expect(snippet.startsWith("She is moving")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("ignores one-letter noise in the query when choosing where to cut", () => {
    const text = `${"padding ".repeat(60)}climbing gym${" tail".repeat(60)}`;
    expect(snippetAround(text, "a climbing")).toContain("climbing gym");
  });

  it("stays within the length it was given", () => {
    const text = "x".repeat(500);
    expect(snippetAround(text, "nothing", 50).length).toBeLessThanOrEqual(52);
  });

  it("has nothing to say about text that is not there", () => {
    expect(snippetAround(null, "climbing")).toBe("");
  });
});

describe("groupResultsByPerson", () => {
  const maya = { id: "person-1", fullName: "Maya" };
  const jules = { id: "person-2", fullName: "Jules" };

  it("gathers every kind of match under the person it is about", () => {
    const grouping = groupResultsByPerson(
      [result(), result({ kind: "note", recordId: "note-1" })],
      [maya],
    );

    expect(grouping.people).toHaveLength(1);
    expect(grouping.people[0]?.person).toBe(maya);
    expect(grouping.people[0]?.results.map((entry) => entry.kind)).toEqual(["update", "note"]);
  });

  it("shows a result naming two people under both of them", () => {
    const grouping = groupResultsByPerson(
      [result({ personIds: ["person-1", "person-2"] })],
      [maya, jules],
    );

    expect(grouping.people.map((group) => group.person)).toEqual([maya, jules]);
    expect(grouping.loose).toEqual([]);
  });

  it("ranks a person by their best match, not their first", () => {
    const grouping = groupResultsByPerson(
      [
        result({ personIds: ["person-1"], rank: 0.1 }),
        result({ personIds: ["person-2"], rank: 0.4, recordId: "update-2" }),
        result({ personIds: ["person-1"], rank: 0.9, recordId: "update-3" }),
      ],
      [maya, jules],
    );

    expect(grouping.people.map((group) => group.person.id)).toEqual(["person-1", "person-2"]);
  });

  it("sets a result naming nobody aside rather than dropping it", () => {
    const grouping = groupResultsByPerson([result({ personIds: [] })], [maya]);

    expect(grouping.people).toEqual([]);
    expect(grouping.loose).toHaveLength(1);
  });

  it("sets aside a result whose person it was not given", () => {
    const grouping = groupResultsByPerson([result({ personIds: ["person-9"] })], [maya]);

    expect(grouping.people).toEqual([]);
    expect(grouping.loose).toHaveLength(1);
  });

  it("keeps the half of a result it can place and does not also loosen it", () => {
    const grouping = groupResultsByPerson(
      [result({ personIds: ["person-1", "person-9"] })],
      [maya],
    );

    expect(grouping.people.map((group) => group.person.id)).toEqual(["person-1"]);
    expect(grouping.loose).toEqual([]);
  });

  it("has nothing to group when nothing matched", () => {
    expect(groupResultsByPerson([], [maya])).toEqual({ people: [], loose: [] });
  });
});
