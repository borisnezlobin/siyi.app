import { describe, expect, it } from "vitest";
import {
  collegeMatchesQuery,
  collegeSearchTerms,
  findCollege,
  searchColleges,
} from "@/lib/colleges";

describe("searchColleges", () => {
  it("puts the school an acronym stands for first", () => {
    expect(searchColleges("cmu")[0].name).toBe("Carnegie Mellon University");
    expect(searchColleges("nyu")[0].name).toBe("New York University");
    expect(searchColleges("mit")[0].name).toBe("Massachusetts Institute of Technology");
  });

  it("prefers the flagship campus over its satellites", () => {
    expect(searchColleges("berkeley")[0].name).toBe("University of California, Berkeley");
    expect(searchColleges("ucla")[0].name).toBe("University of California, Los Angeles");
  });

  it("matches partial names as someone types", () => {
    expect(searchColleges("carnegie").map((college) => college.name)).toContain(
      "Carnegie Mellon University"
    );
    expect(searchColleges("stanf")[0].name).toBe("Stanford University");
  });

  it("ignores case, punctuation and accents", () => {
    expect(searchColleges("U.C. Berkeley")[0].name).toBe("University of California, Berkeley");
    expect(searchColleges("BERKELEY")[0].name).toBe("University of California, Berkeley");
  });

  it("stays quiet until there is enough to go on", () => {
    expect(searchColleges("c")).toEqual([]);
    expect(searchColleges("")).toEqual([]);
  });

  it("returns nothing rather than a wrong guess", () => {
    expect(searchColleges("zzzzzznotaschool")).toEqual([]);
  });
});

describe("findCollege", () => {
  it("resolves a stored value by full name or nickname", () => {
    expect(findCollege("University of California, Berkeley")?.name).toBe(
      "University of California, Berkeley"
    );
    expect(findCollege("cal")?.name).toBe("University of California, Berkeley");
  });

  it("returns null for a school it does not know", () => {
    expect(findCollege("Hogwarts")).toBeNull();
  });
});

describe("collegeMatchesQuery", () => {
  it("finds a person by the acronym of their school", () => {
    expect(collegeMatchesQuery("Carnegie Mellon University", "CMU")).toBe(true);
    expect(collegeMatchesQuery("New York University", "nyu")).toBe(true);
  });

  it("finds a person by the full name when the acronym is stored", () => {
    expect(collegeMatchesQuery("Carnegie Mellon University", "carnegie")).toBe(true);
  });

  it("does not match an unrelated school", () => {
    expect(collegeMatchesQuery("Carnegie Mellon University", "berkeley")).toBe(false);
  });

  it("still matches free text that is not in the list", () => {
    expect(collegeMatchesQuery("Hogwarts", "hogw")).toBe(true);
    expect(collegeMatchesQuery(null, "anything")).toBe(false);
  });

  it("treats an empty query as no filter", () => {
    expect(collegeMatchesQuery("Carnegie Mellon University", "")).toBe(true);
  });
});

describe("collegeSearchTerms", () => {
  it("includes the aliases of a known school", () => {
    expect(collegeSearchTerms("University of California, Berkeley")).toContain("ucb");
  });

  it("is empty when nothing is recorded", () => {
    expect(collegeSearchTerms(null)).toEqual([]);
  });
});
