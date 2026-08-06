import { changedFieldNames, hasUnsavedChanges } from "@/lib/form-changes";

const initial = {
  fullName: "Jordan Lee",
  hometown: "",
  firstMetOn: "2026-02-14",
};

describe("form change tracking", () => {
  it("sees no change when the values match", () => {
    expect(hasUnsavedChanges(initial, { ...initial })).toBe(false);
  });

  it("ignores whitespace-only edits", () => {
    expect(
      hasUnsavedChanges(initial, { ...initial, fullName: "Jordan Lee " }),
    ).toBe(false);
  });

  it("names the fields that actually changed", () => {
    expect(
      changedFieldNames(initial, {
        ...initial,
        hometown: "Boise",
        firstMetOn: "2026-01-30",
      }),
    ).toEqual(["hometown", "firstMetOn"]);
  });

  it("treats a newly filled field as a change", () => {
    expect(hasUnsavedChanges(initial, { ...initial, photoUri: "file://a" })).toBe(
      true,
    );
  });
});
