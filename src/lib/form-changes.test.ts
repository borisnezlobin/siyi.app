import { describe, expect, it } from "vitest";
import { changedFieldNames, hasUnsavedChanges } from "@/lib/form-changes";

const initial = {
  fullName: "Maya Chen",
  hometown: "",
  graduationYear: "2028",
};

describe("form change tracking", () => {
  it("sees no change when the values match", () => {
    expect(hasUnsavedChanges(initial, { ...initial })).toBe(false);
  });

  it("ignores whitespace-only edits", () => {
    expect(
      hasUnsavedChanges(initial, { ...initial, fullName: " Maya Chen " }),
    ).toBe(false);
  });

  it("names the fields that actually changed", () => {
    expect(
      changedFieldNames(initial, {
        ...initial,
        hometown: "Austin",
        graduationYear: "2029",
      }),
    ).toEqual(["hometown", "graduationYear"]);
  });

  it("counts a field that appears or disappears", () => {
    expect(hasUnsavedChanges(initial, { ...initial, note: "New" })).toBe(true);
    expect(hasUnsavedChanges({ ...initial, note: "" }, initial)).toBe(false);
  });
});
