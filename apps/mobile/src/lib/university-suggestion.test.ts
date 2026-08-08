import {
  suggestUniversityFromEmail,
  universitySuggestionNote,
} from "@/lib/university-suggestion";

describe("suggestUniversityFromEmail", () => {
  it("recognises the school an address belongs to", () => {
    expect(suggestUniversityFromEmail("alex@berkeley.edu", "")).toEqual({
      name: "University of California, Berkeley",
      domain: "berkeley.edu",
    });
  });

  it("recognises a department subdomain as the school behind it", () => {
    expect(suggestUniversityFromEmail("alex@cs.stanford.edu", "")).toEqual({
      name: "Stanford University",
      domain: "cs.stanford.edu",
    });
  });

  it("offers nothing for a university domain it does not know", () => {
    expect(suggestUniversityFromEmail("alex@not-a-real-school.edu", "")).toBeNull();
  });

  it("offers nothing for ordinary personal mail", () => {
    expect(suggestUniversityFromEmail("alex@gmail.com", "")).toBeNull();
  });

  it("never overwrites an answer somebody has already given", () => {
    expect(
      suggestUniversityFromEmail("alex@berkeley.edu", "Carnegie Mellon University"),
    ).toBeNull();
    // Including one they are part way through typing.
    expect(suggestUniversityFromEmail("alex@berkeley.edu", "Carn")).toBeNull();
  });

  it("treats whitespace as the blank it looks like", () => {
    expect(suggestUniversityFromEmail("alex@berkeley.edu", "   ")).not.toBeNull();
  });

  it("survives having no address to read", () => {
    expect(suggestUniversityFromEmail(null, "")).toBeNull();
    expect(suggestUniversityFromEmail("", "")).toBeNull();
  });
});

describe("universitySuggestionNote", () => {
  it("says where the answer came from", () => {
    expect(universitySuggestionNote("berkeley.edu")).toBe("From your berkeley.edu address");
  });
});
