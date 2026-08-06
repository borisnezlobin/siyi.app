import { describe, expect, it } from "vitest";
import {
  clearGeocodeCache,
  geocodeHometown,
  summariseHometowns,
} from "@/lib/geocode";

const near = (value: number, expected: number) =>
  expect(Math.abs(value - expected)).toBeLessThan(0.5);

describe("geocodeHometown", () => {
  it("places an exactly spelled hometown", () => {
    const found = geocodeHometown("Berkeley, California");
    expect(found?.label).toBe("Berkeley, California, United States");
    expect(found?.precision).toBe("city");
    near(found!.latitude, 37.87);
    near(found!.longitude, -122.27);
  });

  it("ignores case, punctuation and stray whitespace", () => {
    const canonical = geocodeHometown("San Francisco, California");
    for (const spelling of [
      "san francisco, california",
      "SAN FRANCISCO, CALIFORNIA",
      "  San Francisco,   California  ",
      "San Francisco, California.",
    ]) {
      expect(geocodeHometown(spelling)).toEqual(canonical);
    }
  });

  it("ignores accents in either direction", () => {
    expect(geocodeHometown("São Paulo")).toEqual(geocodeHometown("Sao Paulo"));
    expect(geocodeHometown("Zürich")).toEqual(geocodeHometown("Zurich"));
    expect(geocodeHometown("Bogotá, Colombia")?.label).toContain("Colombia");
  });

  it("reads a city with a state, spelled out or abbreviated", () => {
    const spelledOut = geocodeHometown("Portland, Maine");
    expect(spelledOut?.label).toBe("Portland, Maine, United States");
    expect(geocodeHometown("Portland, ME")).toEqual(spelledOut);
    expect(geocodeHometown("portland me")).toEqual(spelledOut);
  });

  it("keeps the state in charge when the same city name exists elsewhere", () => {
    expect(geocodeHometown("Portland, OR")?.label).toBe(
      "Portland, Oregon, United States",
    );
    expect(geocodeHometown("Paris, TX")?.label).toBe(
      "Paris, Texas, United States",
    );
    expect(geocodeHometown("Paris")?.label).toContain("France");
    expect(geocodeHometown("London, Ontario")?.label).toBe(
      "London, Ontario, Canada",
    );
  });

  it("understands the shorthand people actually type", () => {
    expect(geocodeHometown("SF")).toEqual(geocodeHometown("San Francisco, CA"));
    expect(geocodeHometown("NYC")?.label).toBe(
      "New York City, New York, United States",
    );
    expect(geocodeHometown("DC")?.label).toBe(
      "Washington, District of Columbia, United States",
    );
    expect(geocodeHometown("philly")?.label).toContain("Philadelphia");
    expect(geocodeHometown("St. Louis")?.label).toBe(
      "St. Louis, Missouri, United States",
    );
    expect(geocodeHometown("Ft. Worth, TX")?.label).toBe(
      "Fort Worth, Texas, United States",
    );
  });

  it("falls back to the nearest city it knows for a neighbourhood", () => {
    const losAngeles = geocodeHometown("Los Angeles, CA");
    expect(geocodeHometown("westside LA")).toEqual(losAngeles);
    expect(geocodeHometown("Downtown Chicago")?.label).toContain("Chicago");
    expect(geocodeHometown("Greater Boston")?.label).toContain("Boston");
  });

  it("still matches names that legitimately start with a direction", () => {
    expect(geocodeHometown("West Covina, CA")?.label).toBe(
      "West Covina, California, United States",
    );
    expect(geocodeHometown("North Las Vegas, NV")?.label).toBe(
      "North Las Vegas, Nevada, United States",
    );
    expect(geocodeHometown("New York")?.label).toContain("New York City");
  });

  it("returns nothing rather than a wrong guess for an unknown place", () => {
    expect(geocodeHometown("Nowhere In Particular")).toBeNull();
    expect(geocodeHometown("asdfgh")).toBeNull();
    expect(geocodeHometown("")).toBeNull();
    expect(geocodeHometown(null)).toBeNull();
    expect(geocodeHometown("   ")).toBeNull();
  });

  it("refuses to choose between places that share a name", () => {
    // Cambridge (England), Cambridge (Massachusetts) and Cambridge (Ontario)
    // are all roughly the same size, and San Jose could as easily be Costa Rica.
    expect(geocodeHometown("Cambridge")).toBeNull();
    expect(geocodeHometown("San Jose")).toBeNull();
    expect(geocodeHometown("Springfield")).toBeNull();
    expect(geocodeHometown("Vancouver")).toBeNull();
    // A country and a US state sharing a name, and a city sharing one with a state.
    expect(geocodeHometown("Georgia")).toBeNull();
    expect(geocodeHometown("Washington")).toBeNull();
  });

  it("resolves those same names once a state or country is given", () => {
    expect(geocodeHometown("Cambridge, MA")?.label).toBe(
      "Cambridge, Massachusetts, United States",
    );
    expect(geocodeHometown("San Jose, CA")?.label).toBe(
      "San Jose, California, United States",
    );
    expect(geocodeHometown("Vancouver, BC")?.label).toBe(
      "Vancouver, British Columbia, Canada",
    );
    expect(geocodeHometown("Washington, DC")?.label).toContain(
      "District of Columbia",
    );
  });

  it("will not place a city inside a state it is not in", () => {
    // There is no Berkeley in Texas, so we must not quietly use the Californian
    // one. Falling back to Texas itself is the most we are willing to claim.
    const found = geocodeHometown("Berkeley, Texas");
    expect(found?.precision).toBe("region");
    expect(found?.label).toBe("Texas, United States");
  });

  it("marks a state or country match as approximate", () => {
    expect(geocodeHometown("California")?.precision).toBe("region");
    expect(geocodeHometown("New Jersey")?.precision).toBe("region");
    expect(geocodeHometown("France")?.precision).toBe("country");
    expect(geocodeHometown("USA")?.precision).toBe("country");
    expect(geocodeHometown("UK")?.label).toBe("United Kingdom");
    // A town nobody has heard of still tells us the country.
    const found = geocodeHometown("Petit Village, France");
    expect(found?.precision).toBe("country");
    expect(found?.label).toBe("France");
  });

  it("caches by normalized name without changing the answer", () => {
    clearGeocodeCache();
    const first = geocodeHometown("Seattle, WA");
    const second = geocodeHometown("  seattle,  wa ");
    expect(second).toEqual(first);
    expect(second).toBe(first);
  });
});

describe("summariseHometowns", () => {
  const people = [
    { id: "1", name: "Ana", hometown: "Oakland, California" },
    { id: "2", name: "Ben", hometown: "oakland, ca" },
    { id: "3", name: "Cai", hometown: "Seattle, Washington" },
    { id: "4", name: "Dee", hometown: "Cambridge" },
    { id: "5", name: "Eve", hometown: "Cambridge" },
    { id: "6", name: "Fay", hometown: null },
    { id: "7", name: "Gil", hometown: "   " },
  ];

  it("groups people who wrote the same place differently", () => {
    const { places } = summariseHometowns(people);
    const oakland = places.find((place) => place.label.startsWith("Oakland"));
    expect(oakland?.people.map((person) => person.name)).toEqual(["Ana", "Ben"]);
    expect(places).toHaveLength(2);
  });

  it("puts the busiest place first and gives each one a stable anchor", () => {
    const { places } = summariseHometowns(people);
    expect(places[0].label).toContain("Oakland");
    expect(places[0].key).toBe("oakland-california-united-states");
  });

  it("reports what it could not place instead of hiding it", () => {
    const { unplaced, withoutHometown } = summariseHometowns(people);
    expect(unplaced).toHaveLength(1);
    expect(unplaced[0].hometown).toBe("Cambridge");
    expect(unplaced[0].people.map((person) => person.name)).toEqual(["Dee", "Eve"]);
    expect(withoutHometown.map((person) => person.name)).toEqual(["Fay", "Gil"]);
  });

  it("handles an empty address book", () => {
    expect(summariseHometowns([])).toEqual({
      places: [],
      unplaced: [],
      withoutHometown: [],
    });
  });
});
