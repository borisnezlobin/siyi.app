import { describe, expect, it } from "vitest";
import { normalizeInstagramUsername } from "@/lib/instagram";

describe("normalizeInstagramUsername", () => {
  it("removes a leading at sign and lowercases the username", () => {
    expect(normalizeInstagramUsername("@Maya.Makes")).toBe("maya.makes");
  });

  it("extracts the username from a complete Instagram URL", () => {
    expect(
      normalizeInstagramUsername(
        "https://www.instagram.com/LuisListens/?utm_source=copy",
      ),
    ).toBe("luislistens");
  });

  it("extracts the username from a pasted URL without a protocol", () => {
    expect(normalizeInstagramUsername("instagram.com/AmaraOkafor/")).toBe(
      "amaraokafor",
    );
  });

  it("returns an empty string for an invalid Instagram URL", () => {
    expect(normalizeInstagramUsername("https://instagram.com")).toBe("");
  });

  // The phone shares this file now. These are the cases where the two copies
  // used to disagree, kept here so the shared behaviour is pinned on both sides.
  it.each([
    ["maya.makes/", "maya.makes"],
    ["maya?hl=en", "maya"],
    ["@@maya", "maya"],
    ["maya/photos", "maya"],
    ["@Jordan.Lee", "jordan.lee"],
    ["instagram.com/_campus.friend", "_campus.friend"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeInstagramUsername(input)).toBe(expected);
  });
});
