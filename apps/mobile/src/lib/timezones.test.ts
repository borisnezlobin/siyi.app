import {
  timezoneOffset,
  timezonePlace,
  timezoneTitle,
} from "@/lib/timezones";

describe("friendly timezone labels", () => {
  it("turns a stored IANA value into a familiar place and name", () => {
    expect(timezoneTitle("America/Los_Angeles")).toBe("Pacific Time");
    expect(timezonePlace("America/Los_Angeles")).toContain("Los Angeles");
    expect(timezonePlace("America/Los_Angeles")).toContain("United States");
  });

  it("keeps the technical value out of the primary label", () => {
    expect(timezoneTitle("Europe/Madrid")).not.toContain("/");
    expect(timezoneOffset("Europe/Madrid")).toMatch(/^GMT[+−]/);
  });

  it("provides a readable fallback for an unknown timezone", () => {
    expect(timezoneTitle("Mars/Olympus_Mons")).toBe("Olympus Mons");
  });
});
