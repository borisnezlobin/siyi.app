import { describe, expect, it } from "vitest";
import {
  customTypeIconKeys,
  isCustomTypeIconKey,
} from "@/lib/custom-type-icons";

describe("choosing an icon for a custom update type", () => {
  it("accepts every key the picker offers", () => {
    for (const key of customTypeIconKeys) {
      expect(isCustomTypeIconKey(key)).toBe(true);
    }
  });

  it("rejects anything that is not one of ours, including an emoji", () => {
    expect(isCustomTypeIconKey("🧗")).toBe(false);
    expect(isCustomTypeIconKey("skateboard")).toBe(false);
    expect(isCustomTypeIconKey("")).toBe(false);
    expect(isCustomTypeIconKey(null)).toBe(false);
    expect(isCustomTypeIconKey(undefined)).toBe(false);
  });
});
