import { describe, expect, it } from "vitest";
import {
  interactionLabels,
  interactionTypeFromLabel,
} from "@/lib/interaction-labels";
import { interactionTypes } from "@/lib/types";

describe("working a saved label back to a type", () => {
  it("round-trips every label the picker can produce", () => {
    for (const type of interactionTypes) {
      expect(interactionTypeFromLabel(interactionLabels[type])).toBe(type);
    }
  });

  it("ignores casing and stray whitespace", () => {
    expect(interactionTypeFromLabel("  cOFFee ")).toBe("coffee");
  });

  it("falls back to other for labels it has never seen", () => {
    // "Talked" was the default before the picker existed.
    expect(interactionTypeFromLabel("Talked")).toBe("other");
    expect(interactionTypeFromLabel("Went bouldering")).toBe("other");
  });

  it("falls back to other when there is no label at all", () => {
    expect(interactionTypeFromLabel(null)).toBe("other");
    expect(interactionTypeFromLabel("")).toBe("other");
  });
});
