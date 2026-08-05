import { describe, expect, it } from "vitest";
import { friendlyTimezoneOptions } from "@/lib/timezones";

describe("friendlyTimezoneOptions", () => {
  it("uses familiar labels while preserving the stored timezone value", () => {
    const options = friendlyTimezoneOptions("America/Los_Angeles");
    const pacific = options.find(
      ({ value }) => value === "America/Los_Angeles",
    );

    expect(pacific?.label).toContain("Pacific Time");
    expect(pacific?.label).toContain("Los Angeles");
    expect(pacific?.label).not.toContain("America/");
  });

  it("keeps a compatible grouped timezone selectable", () => {
    const options = friendlyTimezoneOptions("America/Boise");
    expect(options.some(({ value }) => value === "America/Boise")).toBe(true);
  });
});
