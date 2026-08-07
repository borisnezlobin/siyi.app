import {
  timezoneOffset,
  timezonePlace,
  timezoneTitle,
  timezoneMatchRank,
  type FriendlyTimezone,
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

describe("timezoneMatchRank", () => {
  const zone = (overrides: Partial<FriendlyTimezone> = {}) =>
    ({
      name: "America/Los_Angeles",
      alternativeName: "Pacific Time",
      abbreviation: "PT",
      countryName: "United States",
      continentName: "North America",
      mainCities: ["Los Angeles", "San Diego"],
      group: [],
      ...overrides,
    }) as FriendlyTimezone;

  it("puts the name a zone is known by above a passing mention", () => {
    const losAngeles = timezoneMatchRank(zone(), "pacific time");
    const apia = timezoneMatchRank(
      zone({ alternativeName: "Apia Time", mainCities: ["Apia"] }),
      "pacific time",
    );
    expect(losAngeles).toBeGreaterThan(apia);
  });

  it("matches an abbreviation exactly", () => {
    expect(timezoneMatchRank(zone(), "pt")).toBe(5);
  });

  it("ranks a city the searcher named", () => {
    expect(timezoneMatchRank(zone(), "los angeles")).toBe(3);
    expect(timezoneMatchRank(zone(), "los")).toBe(2);
  });

  it("is zero when nothing matches", () => {
    expect(timezoneMatchRank(zone(), "tokyo")).toBe(0);
    expect(timezoneMatchRank(zone(), "")).toBe(0);
  });
});
