import { looksLikeUuid, personRouteIdentifier } from "@/lib/person-links";

describe("looksLikeUuid", () => {
  it("recognises the ids older links carry", () => {
    expect(looksLikeUuid("3f2b6a1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b")).toBe(true);
  });

  it("does not mistake a slug for an id", () => {
    expect(looksLikeUuid("alex-vale-7fk2")).toBe(false);
  });
});

describe("personRouteIdentifier", () => {
  it("reads a uuid link", () => {
    expect(
      personRouteIdentifier("/people/3f2b6a1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b"),
    ).toBe("3f2b6a1e-1c2d-4e5f-8a9b-0c1d2e3f4a5b");
  });

  it("reads a slug link", () => {
    expect(personRouteIdentifier("/people/alex-vale-7fk2")).toBe(
      "alex-vale-7fk2",
    );
  });

  it("leaves other routes alone", () => {
    expect(personRouteIdentifier("/people/new")).toBeNull();
    expect(personRouteIdentifier("/reminders")).toBeNull();
    expect(personRouteIdentifier("/people/abc/edit")).toBeNull();
    expect(personRouteIdentifier("/people/")).toBeNull();
    expect(personRouteIdentifier("https://example.com/people/abc")).toBeNull();
  });
});
