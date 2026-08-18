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

  // The cases this app carried before it shared the web's copy of the helper.
  it.each([
    ["@Jordan.Lee", "jordan.lee"],
    ["https://instagram.com/Jordan.Lee/?hl=en", "jordan.lee"],
    ["instagram.com/_campus.friend", "_campus.friend"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeInstagramUsername(input)).toBe(expected);
  });

  // The reason the two copies had to be reconciled: a handle pasted with a
  // trailing slash or a query saved on the web and was refused on the phone,
  // because only the web trimmed them before validation looked.
  it.each([
    ["maya.makes/", "maya.makes"],
    ["maya?hl=en", "maya"],
    ["@@maya", "maya"],
    ["maya/photos", "maya"],
  ])("accepts %s, which the phone used to reject", (input, expected) => {
    expect(normalizeInstagramUsername(input)).toBe(expected);
  });
});
