import { describe, expect, it } from "vitest";
import {
  normalizeForSearch,
  rankPeopleForPicker,
  type PickablePerson,
} from "@/lib/person-search";

function person(
  id: string,
  fullName: string,
  overrides: Partial<PickablePerson> = {},
): PickablePerson {
  return { id, fullName, ...overrides };
}

const namesOf = (people: PickablePerson[]) =>
  people.map((entry) => entry.fullName);

describe("normalizing a name for search", () => {
  it("ignores case and accents", () => {
    expect(normalizeForSearch("  José ")).toBe("jose");
  });
});

describe("ranking people in the picker", () => {
  it("offers the name that starts with the query before one that merely contains it", () => {
    const results = rankPeopleForPicker(
      [person("1", "Rosamund Pike"), person("2", "Sam Ortega")],
      "sam",
    );

    expect(namesOf(results)).toEqual(["Sam Ortega", "Rosamund Pike"]);
  });

  it("matches on a surname, not just the first word", () => {
    const results = rankPeopleForPicker(
      [person("1", "Amelia Chen"), person("2", "Luis Ortega")],
      "chen",
    );

    expect(namesOf(results)).toEqual(["Amelia Chen"]);
  });

  it("finds someone by the name their friends actually use", () => {
    const results = rankPeopleForPicker(
      [person("1", "Zihao Yan", { preferredName: "Jerry" })],
      "jerry",
    );

    expect(results).toHaveLength(1);
  });

  it("ignores accents so a name typed plainly still finds them", () => {
    const results = rankPeopleForPicker([person("1", "José Álvarez")], "jose");

    expect(results).toHaveLength(1);
  });

  it("shows whoever was seen most recently when nothing is typed", () => {
    const results = rankPeopleForPicker(
      [
        person("1", "Amelia Chen", { lastInteractionAt: "2026-01-01T00:00:00Z" }),
        person("2", "Luis Ortega", { lastInteractionAt: "2026-06-01T00:00:00Z" }),
        person("3", "Never Met"),
      ],
      "",
    );

    expect(namesOf(results)).toEqual(["Luis Ortega", "Amelia Chen", "Never Met"]);
  });

  it("breaks ties alphabetically so the order never jitters", () => {
    const results = rankPeopleForPicker(
      [person("1", "Sam Zeta"), person("2", "Sam Alpha")],
      "sam",
    );

    expect(namesOf(results)).toEqual(["Sam Alpha", "Sam Zeta"]);
  });

  it("returns nothing when nobody matches", () => {
    expect(rankPeopleForPicker([person("1", "Amelia Chen")], "zzz")).toEqual([]);
  });

  it("caps the list so a long contact book stays navigable", () => {
    const many = Array.from({ length: 300 }, (_, index) =>
      person(String(index), `Sam Number ${index}`),
    );

    expect(rankPeopleForPicker(many, "sam")).toHaveLength(8);
  });

  it("survives a stored date that is not a real date", () => {
    const results = rankPeopleForPicker(
      [person("1", "Amelia Chen", { lastInteractionAt: "not a date" })],
      "",
    );

    expect(results).toHaveLength(1);
  });
});
