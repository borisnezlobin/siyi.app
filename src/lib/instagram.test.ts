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
});
