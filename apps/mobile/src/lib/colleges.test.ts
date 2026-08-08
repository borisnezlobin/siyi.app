import {
  collegeForEmail,
  collegeMatchesQuery,
  collegeSearchTerms,
  emailDomain,
  findCollege,
  searchColleges,
} from "@/lib/colleges";

describe("collegeForEmail", () => {
  it("recognises a school from its own domain", () => {
    expect(collegeForEmail("someone@berkeley.edu")?.name).toBe(
      "University of California, Berkeley",
    );
  });

  it("recognises a department subdomain as the school it belongs to", () => {
    expect(collegeForEmail("someone@cs.stanford.edu")?.name).toBe("Stanford University");
    expect(collegeForEmail("someone@eecs.berkeley.edu")?.name).toBe(
      "University of California, Berkeley",
    );
  });

  it("says nothing for a university domain it has never heard of", () => {
    expect(collegeForEmail("someone@not-a-real-school.edu")).toBeNull();
  });

  it("says nothing for ordinary personal mail", () => {
    expect(collegeForEmail("someone@gmail.com")).toBeNull();
  });

  it("never guesses a school from a bare suffix", () => {
    expect(collegeForEmail("someone@edu")).toBeNull();
    expect(collegeForEmail("someone@ac.uk")).toBeNull();
  });

  it("takes a bare domain as readily as a whole address", () => {
    expect(collegeForEmail("berkeley.edu")?.name).toBe(
      "University of California, Berkeley",
    );
  });

  it("survives nothing at all", () => {
    expect(collegeForEmail("")).toBeNull();
    expect(collegeForEmail(null)).toBeNull();
    expect(collegeForEmail(undefined)).toBeNull();
  });
});

describe("emailDomain", () => {
  it("quotes back the part worth naming", () => {
    expect(emailDomain("Someone@Berkeley.edu")).toBe("berkeley.edu");
    expect(emailDomain("someone@cs.stanford.edu")).toBe("cs.stanford.edu");
    expect(emailDomain(null)).toBe("");
  });
});

describe("searchColleges", () => {
  it("puts the school an acronym stands for first", () => {
    expect(searchColleges("cmu")[0].name).toBe("Carnegie Mellon University");
    expect(searchColleges("nyu")[0].name).toBe("New York University");
    expect(searchColleges("mit")[0].name).toBe("Massachusetts Institute of Technology");
  });

  it("prefers the flagship campus over its satellites", () => {
    expect(searchColleges("uc berkeley")[0].name).toBe("University of California, Berkeley");
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
    expect(searchColleges("UC BERKELEY")[0].name).toBe("University of California, Berkeley");
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
    expect(findCollege("uc berkeley")?.name).toBe("University of California, Berkeley");
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
    expect(collegeSearchTerms("University of California, Berkeley")).toContain("uc berkeley");
  });

  it("is empty when nothing is recorded", () => {
    expect(collegeSearchTerms(null)).toEqual([]);
  });
});
