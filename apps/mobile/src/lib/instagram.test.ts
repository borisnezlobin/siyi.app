import { normalizeInstagramUsername } from "@/lib/instagram";

describe("normalizeInstagramUsername", () => {
  it.each([
    ["@Jordan.Lee", "jordan.lee"],
    ["https://instagram.com/Jordan.Lee/?hl=en", "jordan.lee"],
    ["instagram.com/_campus.friend", "_campus.friend"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeInstagramUsername(input)).toBe(expected);
  });
});
