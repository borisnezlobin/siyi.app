import { collegeSearchTerms } from "@/lib/colleges";
import {
  type FilterablePerson,
  isMissingDetail,
  matchesPeopleQuery,
  missingDetailsOf,
  sectionPeopleAlphabetically,
} from "@/lib/people-filters";

const person = (overrides: Partial<FilterablePerson> = {}): FilterablePerson => ({
  fullName: "Ana Kim",
  ...overrides,
});

describe("missing details", () => {
  it("spots someone with nothing recorded", () => {
    expect(missingDetailsOf(person())).toEqual(["birthday", "email", "phone"]);
  });

  it("counts a contact method, not just the legacy column", () => {
    const withMethods = person({
      contactMethods: [
        { kind: "email", value: "ana@example.com" },
        { kind: "phone", value: "+1 555 0100" },
      ],
    });
    expect(missingDetailsOf(withMethods)).toEqual(["birthday"]);
  });

  it("treats blank strings as missing", () => {
    expect(isMissingDetail(person({ email: "   " }), "email")).toBe(true);
    expect(isMissingDetail(person({ phoneNumber: "" }), "phone")).toBe(true);
  });

  it("sees a birthday once it is set", () => {
    expect(isMissingDetail(person({ birthday: "2001-04-12" }), "birthday")).toBe(false);
  });
});

describe("matchesPeopleQuery", () => {
  it("finds someone by their school's acronym once the college list is supplied", () => {
    const jordan = person({ fullName: "Jordan Tran", university: "Carnegie Mellon University" });
    expect(matchesPeopleQuery(jordan, "CMU", collegeSearchTerms)).toBe(true);
    expect(matchesPeopleQuery(jordan, "nyu", collegeSearchTerms)).toBe(false);
  });

  it("matches the school as written before that list has loaded", () => {
    const jordan = person({ fullName: "Jordan Tran", university: "Carnegie Mellon University" });
    expect(matchesPeopleQuery(jordan, "carnegie")).toBe(true);
    expect(matchesPeopleQuery(jordan, "CMU")).toBe(false);
  });

  it("finds someone by name, tag or hometown", () => {
    const ana = person({ hometown: "Seoul", tags: [{ name: "climbing" }] });
    expect(matchesPeopleQuery(ana, "ana")).toBe(true);
    expect(matchesPeopleQuery(ana, "seoul")).toBe(true);
    expect(matchesPeopleQuery(ana, "climb")).toBe(true);
    expect(matchesPeopleQuery(ana, "rowing")).toBe(false);
  });

  it("ignores punctuation and case", () => {
    expect(matchesPeopleQuery(person({ fullName: "José Álvarez" }), "jose")).toBe(true);
  });

  it("treats an empty query as everyone", () => {
    expect(matchesPeopleQuery(person(), "")).toBe(true);
  });
});

describe("sectionPeopleAlphabetically", () => {
  it("groups by the name shown, not the legal name", () => {
    const sections = sectionPeopleAlphabetically([
      person({ fullName: "Boris Nezlobin" }),
      person({ fullName: "Ana Kim" }),
      person({ fullName: "Robert Zhang", preferredName: "Bobby" }),
    ]);
    expect(sections.map((section) => section.letter)).toEqual(["A", "B"]);
    expect(sections[1].people.map((entry) => entry.preferredName ?? entry.fullName)).toEqual([
      "Bobby",
      "Boris Nezlobin",
    ]);
  });

  it("collects non-letter names under # at the end", () => {
    const sections = sectionPeopleAlphabetically([
      person({ fullName: "42 Robotics Guy" }),
      person({ fullName: "Ana Kim" }),
    ]);
    expect(sections.map((section) => section.letter)).toEqual(["A", "#"]);
  });

  it("returns nothing for an empty list", () => {
    expect(sectionPeopleAlphabetically([])).toEqual([]);
  });
});
