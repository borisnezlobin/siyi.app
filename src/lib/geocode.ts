import { collegeCoordinates, collegePlaceCandidates } from "@/lib/colleges";
import { cityTable, countryTable, regionTable } from "@/lib/place-table";

/**
 * Turns a free-text hometown into coordinates using only the place table
 * committed alongside this file. No network call, ever: a hometown is personal
 * and never leaves our servers.
 *
 * The guiding rule is that a wrong pin is worse than a missing one. When a name
 * could plausibly mean two far-apart places, this returns nothing and the map
 * lists the hometown as unplaced, which tells the owner what to spell out.
 */

export type PlacePrecision = "city" | "region" | "country";

export type GeocodedPlace = {
  label: string;
  latitude: number;
  longitude: number;
  precision: PlacePrecision;
};

type PlaceEntry = GeocodedPlace & {
  /** City population, or nothing for a region or country. */
  weight: number;
  regionName: string;
  countryName: string;
};

/**
 * A bare name only wins if it is this many times more populous than the next
 * place sharing it. "Portland" clears it comfortably; "Cambridge", "San Jose"
 * and "Vancouver" do not, and stay unplaced rather than land in the wrong
 * country.
 */
const dominantPopulationRatio = 4;

/** Two matches closer together than this are treated as the same place. */
const samePlaceKilometres = 200;

/** Lowercase, unaccented, punctuation-free, single-spaced. */
export function normalizePlaceName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const wordExpansions: Record<string, string> = {
  st: "saint",
  ste: "sainte",
  mt: "mount",
  ft: "fort",
  n: "north",
  s: "south",
  e: "east",
  w: "west",
  hts: "heights",
};

/** "St. Louis" and "N. Las Vegas" spelled the way the table spells them. */
function expandWords(value: string) {
  const words = value.split(" ");
  return words
    .map((word, index) =>
      index < words.length - 1 ? (wordExpansions[word] ?? word) : word,
    )
    .join(" ");
}

/**
 * Nicknames people actually type, rewritten into a full "city, region" form.
 * Kept deliberately short: every entry is a guess we make on the owner's
 * behalf, so it has to be one nobody would argue with.
 */
const hometownAliases: Record<string, string> = {
  sf: "san francisco, california",
  sfo: "san francisco, california",
  "san fran": "san francisco, california",
  frisco: "san francisco, california",
  "the bay": "san francisco, california",
  "bay area": "san francisco, california",
  "the bay area": "san francisco, california",
  norcal: "san francisco, california",
  socal: "los angeles, california",
  "silicon valley": "san jose, california",
  nyc: "new york city, new york",
  "new york": "new york city, new york",
  manhattan: "new york city, new york",
  brooklyn: "new york city, new york",
  la: "los angeles, california",
  lax: "los angeles, california",
  dc: "washington, district of columbia",
  "washington dc": "washington, district of columbia",
  "d c": "washington, district of columbia",
  philly: "philadelphia, pennsylvania",
  vegas: "las vegas, nevada",
  nola: "new orleans, louisiana",
  atx: "austin, texas",
  pdx: "portland, oregon",
  atl: "atlanta, georgia",
  "chi town": "chicago, illinois",
  bmore: "baltimore, maryland",
  cdmx: "mexico city, mexico",
  "mexico d f": "mexico city, mexico",
  bombay: "mumbai, maharashtra",
  calcutta: "kolkata, west bengal",
  madras: "chennai, tamil nadu",
  saigon: "ho chi minh city, vietnam",
  peking: "beijing, china",
};

/**
 * Cities whose English name is nothing like their local one. GeoNames lists
 * these under the English spelling only, so without this a German writing
 * "München" would land in the unplaced list.
 */
const localCityNames: Record<string, string> = {
  munchen: "munich, germany",
  koln: "cologne, germany",
  wien: "vienna, austria",
  roma: "rome, italy",
  firenze: "florence, italy",
  milano: "milan, italy",
  napoli: "naples, italy",
  venezia: "venice, italy",
  torino: "turin, italy",
  genova: "genoa, italy",
  lisboa: "lisbon, portugal",
  praha: "prague, czechia",
  warszawa: "warsaw, poland",
  krakow: "krakow, poland",
  moskva: "moscow, russia",
  kobenhavn: "copenhagen, denmark",
  goteborg: "gothenburg, sweden",
  "den haag": "the hague, netherlands",
  sevilla: "seville, spain",
  bruxelles: "brussels, belgium",
  brussel: "brussels, belgium",
  antwerpen: "antwerp, belgium",
  geneve: "geneva, switzerland",
  athina: "athens, greece",
  bucuresti: "bucharest, romania",
  beograd: "belgrade, serbia",
};

for (const [local, canonical] of Object.entries(localCityNames)) {
  hometownAliases[local] = canonical;
}

/** Postal and everyday shorthand that only makes sense as a qualifier. */
const regionAbbreviations: Record<string, string> = {
  al: "alabama",
  ak: "alaska",
  az: "arizona",
  ar: "arkansas",
  ca: "california",
  co: "colorado",
  ct: "connecticut",
  de: "delaware",
  fl: "florida",
  ga: "georgia",
  hi: "hawaii",
  id: "idaho",
  il: "illinois",
  in: "indiana",
  ia: "iowa",
  ks: "kansas",
  ky: "kentucky",
  la: "louisiana",
  me: "maine",
  md: "maryland",
  ma: "massachusetts",
  mi: "michigan",
  mn: "minnesota",
  ms: "mississippi",
  mo: "missouri",
  mt: "montana",
  ne: "nebraska",
  nv: "nevada",
  nh: "new hampshire",
  nj: "new jersey",
  nm: "new mexico",
  ny: "new york",
  nc: "north carolina",
  nd: "north dakota",
  oh: "ohio",
  ok: "oklahoma",
  or: "oregon",
  pa: "pennsylvania",
  ri: "rhode island",
  sc: "south carolina",
  sd: "south dakota",
  tn: "tennessee",
  tx: "texas",
  ut: "utah",
  vt: "vermont",
  va: "virginia",
  wa: "washington",
  wv: "west virginia",
  wi: "wisconsin",
  wy: "wyoming",
  pr: "puerto rico",
  dc: "district of columbia",
  bc: "british columbia",
  ab: "alberta",
  sk: "saskatchewan",
  mb: "manitoba",
  qc: "quebec",
  on: "ontario",
  nb: "new brunswick",
  ns: "nova scotia",
  nsw: "new south wales",
  qld: "queensland",
  usa: "united states",
  us: "united states",
  "u s": "united states",
  "u s a": "united states",
  america: "united states",
  uk: "united kingdom",
  gb: "united kingdom",
  uae: "united arab emirates",
  nz: "new zealand",
  prc: "china",
};

/**
 * Words that describe a part of a place rather than a place. Stripped only
 * after the full name has already failed, so "West Covina" and "North Las
 * Vegas" match themselves before "westside LA" falls back to "LA".
 */
const qualifierWords = new Set([
  "greater",
  "metro",
  "metropolitan",
  "downtown",
  "uptown",
  "midtown",
  "central",
  "north",
  "south",
  "east",
  "west",
  "northern",
  "southern",
  "eastern",
  "western",
  "northeast",
  "northwest",
  "southeast",
  "southwest",
  "upper",
  "lower",
  "outer",
  "inner",
  "outside",
  "near",
  "side",
  "westside",
  "eastside",
  "northside",
  "southside",
  "area",
  "suburbs",
  "suburb",
  "suburban",
  "the",
  "city",
  "town",
  "county",
  "originally",
  "from",
]);

type PlaceIndex = {
  cities: Map<string, PlaceEntry[]>;
  regions: Map<string, PlaceEntry[]>;
  countries: Map<string, PlaceEntry[]>;
};

let cachedIndex: PlaceIndex | null = null;

function parseTable(table: string) {
  return table
    .trim()
    .split("\n")
    .map((line) => line.split("\t"));
}

/** "Tokyo, Tokyo, Japan" reads badly, so repeated parts are folded away. */
function joinLabel(parts: string[]) {
  const kept: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    const normalized = normalizePlaceName(part);
    if (kept.some((existing) => normalizePlaceName(existing) === normalized)) continue;
    kept.push(part);
  }
  return kept.join(", ");
}

function addTo(index: Map<string, PlaceEntry[]>, key: string, entry: PlaceEntry) {
  if (!key) return;
  const existing = index.get(key);
  if (existing) existing.push(entry);
  else index.set(key, [entry]);
}

/**
 * Built on first use rather than at import, so pages that never geocode do not
 * pay for parsing 34,000 rows.
 */
function placeIndex(): PlaceIndex {
  if (cachedIndex) return cachedIndex;

  const regionNames = new Map<string, string>();
  const countryNames = new Map<string, string>();
  const regions = new Map<string, PlaceEntry[]>();
  const countries = new Map<string, PlaceEntry[]>();

  for (const [code, name, latitude, longitude] of parseTable(countryTable)) {
    countryNames.set(code, name);
    addTo(countries, normalizePlaceName(name), {
      label: name,
      latitude: Number(latitude),
      longitude: Number(longitude),
      precision: "country",
      weight: 0,
      regionName: "",
      countryName: name,
    });
  }

  for (const [key, name, latitude, longitude] of parseTable(regionTable)) {
    regionNames.set(key, name);
    const countryName = countryNames.get(key.split(".")[0]) ?? "";
    addTo(regions, normalizePlaceName(name), {
      label: joinLabel([name, countryName]),
      latitude: Number(latitude),
      longitude: Number(longitude),
      precision: "region",
      weight: 0,
      regionName: name,
      countryName,
    });
  }

  const cities = new Map<string, PlaceEntry[]>();
  for (const [name, key, latitude, longitude, population, localName] of parseTable(
    cityTable,
  )) {
    const regionName = regionNames.get(key) ?? "";
    const countryName = countryNames.get(key.split(".")[0]) ?? "";
    const entry: PlaceEntry = {
      // The local spelling is the friendlier label; the ASCII one is still a key.
      label: joinLabel([localName || name, regionName, countryName]),
      latitude: Number(latitude),
      longitude: Number(longitude),
      precision: "city",
      weight: Number(population) || 0,
      regionName,
      countryName,
    };
    const asciiKey = normalizePlaceName(name);
    addTo(cities, asciiKey, entry);
    if (localName) {
      const localKey = normalizePlaceName(localName);
      if (localKey && localKey !== asciiKey) addTo(cities, localKey, entry);
    }
  }

  cachedIndex = { cities, regions, countries };
  return cachedIndex;
}

function kilometresApart(a: PlaceEntry, b: PlaceEntry) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadius = 6371;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Everything a bare name could mean, across all three tiers. */
function candidatesFor(name: string) {
  const index = placeIndex();
  return [
    ...(index.cities.get(name) ?? []),
    ...(index.regions.get(name) ?? []),
    ...(index.countries.get(name) ?? []),
  ];
}

function knownPlaceName(name: string) {
  return candidatesFor(name).length > 0;
}

/**
 * Picks between places sharing a name, or gives up. Anything that survives here
 * is a match we are willing to draw on a map.
 */
function resolveAmongCandidates(candidates: PlaceEntry[]): PlaceEntry | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const cities = candidates.filter((entry) => entry.precision === "city");
  const broader = candidates.filter((entry) => entry.precision !== "city");

  // A city that shares its name with its own region or country — Singapore,
  // Kuwait, New York — is not really ambiguous. Far-apart clashes are.
  if (cities.length > 0 && broader.length > 0) {
    const closest = [...cities].sort((a, b) => b.weight - a.weight)[0];
    const nearest = Math.min(
      ...broader.map((entry) => kilometresApart(closest, entry)),
    );
    if (nearest > samePlaceKilometres) return null;
  }

  const pool = cities.length > 0 ? cities : broader;
  if (pool.length === 1) return pool[0];

  const ranked = [...pool].sort((a, b) => b.weight - a.weight);
  const [first, second] = ranked;
  if (kilometresApart(first, second) <= samePlaceKilometres) return first;
  if (first.weight > 0 && first.weight >= second.weight * dominantPopulationRatio) {
    return first;
  }

  // "Mexico" is a country that also names one of its own states. "Georgia" is
  // a country that shares its name with a US state, which is a real ambiguity
  // and stays unresolved.
  const country = pool.find((entry) => entry.precision === "country");
  if (country && pool.every((entry) => entry.countryName === country.countryName)) {
    return country;
  }
  return null;
}

function matchesQualifier(entry: PlaceEntry, token: string) {
  return (
    normalizePlaceName(entry.regionName) === token ||
    normalizePlaceName(entry.countryName) === token
  );
}

function lookupWithQualifiers(name: string, tokens: string[]): PlaceEntry | null {
  const candidates = candidatesFor(name);
  if (candidates.length === 0) return null;
  if (tokens.length === 0) return resolveAmongCandidates(candidates);

  const matchingAll = candidates.filter((entry) =>
    tokens.every((token) => matchesQualifier(entry, token)),
  );
  if (matchingAll.length > 0) return resolveAmongCandidates(matchingAll);

  const matchingAny = candidates.filter((entry) =>
    tokens.some((token) => matchesQualifier(entry, token)),
  );
  if (matchingAny.length > 0) return resolveAmongCandidates(matchingAny);

  // The qualifier names a real place but no candidate sits inside it, so the
  // two halves of the hometown disagree. Guessing here is how you get a wrong
  // pin, so we do not.
  if (tokens.some(knownPlaceName)) return null;
  return resolveAmongCandidates(candidates);
}

function expandQualifier(token: string) {
  return regionAbbreviations[token] ?? token;
}

/** Splits an alias like "san francisco, california" into name and qualifiers. */
function expandAlias(name: string): [string, string[]] {
  const alias = hometownAliases[name];
  if (!alias) return [name, []];
  const [head, ...rest] = alias.split(",").map((part) => part.trim());
  return [head, rest];
}

/**
 * "Berkeley CA" with no comma: peel a word or two off the end when it names a
 * region and what is left still names a place.
 */
function splitTrailingQualifier(name: string): [string, string[]] {
  const words = name.split(" ");
  for (const size of [2, 1]) {
    if (words.length <= size) continue;
    const tail = words.slice(-size).join(" ");
    const expanded = expandQualifier(tail);
    if (expanded === tail && !knownPlaceName(tail)) continue;
    const head = words.slice(0, -size).join(" ");
    if (headVariants(head).some(knownPlaceName)) return [head, [expanded]];
  }
  return [name, []];
}

function withoutQualifierWords(name: string) {
  return name
    .split(" ")
    .filter((word) => !qualifierWords.has(word))
    .join(" ");
}

/**
 * Ways of reading one name, most literal first. The order is the whole safety
 * story: "St. Louis" has to find Missouri before the expansion to "Saint Louis"
 * offers up Senegal, and a real name has to beat its own stripped-down form.
 */
function headVariants(name: string): string[] {
  const alias = ([head]: [string, string[]]) => head;
  const forms = [
    name,
    alias(expandAlias(name)),
    expandWords(name),
    expandQualifier(name),
    withoutQualifierWords(name),
    alias(expandAlias(withoutQualifierWords(name))),
    expandWords(withoutQualifierWords(name)),
  ];
  return [...new Set(forms.filter(Boolean))];
}

function lookupPlace(hometown: string): PlaceEntry | null {
  const segments = hometown.split(",").map(normalizePlaceName).filter(Boolean);
  if (segments.length === 0) return null;

  let head = segments[0];
  let tokens = segments.slice(1).map((part) => expandQualifier(expandWords(part)));

  if (tokens.length === 0 && !hometownAliases[head]) {
    [head, tokens] = splitTrailingQualifier(head);
  }

  for (const variant of headVariants(head)) {
    const [name, aliasTokens] = expandAlias(variant);
    const found = lookupWithQualifiers(name, [...aliasTokens, ...tokens]);
    if (found) return found;
  }

  // "Somewhere nobody has heard of, France" still belongs on the map, as long
  // as it is labelled as the country rather than passed off as the town.
  for (const token of [...tokens].reverse()) {
    const broader = resolveAmongCandidates(
      candidatesFor(token).filter((entry) => entry.precision !== "city"),
    );
    if (broader) return broader;
  }
  return null;
}

/**
 * Resolved hometowns are memoised for the life of the process, so two people
 * from the same town — or the same page rendered twice — cost one lookup.
 */
const resolvedCache = new Map<string, GeocodedPlace | null>();

export function geocodeHometown(
  hometown: string | null | undefined,
): GeocodedPlace | null {
  if (!hometown) return null;
  const key = normalizePlaceName(hometown);
  if (!key) return null;
  if (resolvedCache.has(key)) return resolvedCache.get(key) ?? null;

  const entry = lookupPlace(hometown);
  const result: GeocodedPlace | null = entry
    ? {
        label: entry.label,
        latitude: entry.latitude,
        longitude: entry.longitude,
        precision: entry.precision,
      }
    : null;

  resolvedCache.set(key, result);
  return result;
}

/** Exposed for tests; the cache is otherwise process-lifetime by design. */
export function clearGeocodeCache() {
  resolvedCache.clear();
}

export type MappablePerson = {
  id: string;
  name: string;
  hometown: string | null;
  university?: string | null;
};

/** Which place on a person the map is showing. */
export type MapMode = "hometown" | "college";

function collegeCoordinatesAsPlace(university: string): GeocodedPlace | null {
  const found = collegeCoordinates(university);
  if (!found) return null;
  return {
    label: found.label,
    latitude: found.latitude,
    longitude: found.longitude,
    precision: "city",
  };
}

export type HometownPlace = GeocodedPlace & {
  key: string;
  people: { id: string; name: string }[];
};

export type UnplacedHometown = {
  hometown: string;
  people: { id: string; name: string }[];
};

export type HometownSummary = {
  places: HometownPlace[];
  unplaced: UnplacedHometown[];
  withoutHometown: { id: string; name: string }[];
};

function slugForKey(value: string) {
  return normalizePlaceName(value).replace(/ /g, "-") || "place";
}

/**
 * Sorts a list of people into pins, hometowns we could not place, and people
 * who have not told us where they are from. The middle group is the point: it
 * is the only honest way to show what the place table is missing.
 */
export function summariseHometowns(
  people: MappablePerson[],
  mode: MapMode = "hometown",
): HometownSummary {
  const places = new Map<string, HometownPlace>();
  const unplaced = new Map<string, UnplacedHometown>();
  const withoutHometown: { id: string; name: string }[] = [];

  for (const person of people) {
    const hometown =
      mode === "college" ? person.university?.trim() : person.hometown?.trim();
    const entry = { id: person.id, name: person.name };

    if (!hometown) {
      withoutHometown.push(entry);
      continue;
    }

    const found =
      mode === "college"
        ? collegeCoordinatesAsPlace(hometown) ??
          collegePlaceCandidates(hometown)
            .map((candidate) => geocodeHometown(candidate))
            .find(Boolean) ??
          null
        : geocodeHometown(hometown);
    if (!found) {
      const key = normalizePlaceName(hometown);
      const existing = unplaced.get(key);
      if (existing) existing.people.push(entry);
      else unplaced.set(key, { hometown, people: [entry] });
      continue;
    }

    const key = found.label;
    const existing = places.get(key);
    if (existing) existing.people.push(entry);
    else places.set(key, { ...found, key: slugForKey(key), people: [entry] });
  }

  const byCountThenName = <T extends { people: unknown[] }>(
    nameOf: (item: T) => string,
  ) => (a: T, b: T) =>
    b.people.length - a.people.length || nameOf(a).localeCompare(nameOf(b));

  return {
    places: [...places.values()].sort(byCountThenName((place) => place.label)),
    unplaced: [...unplaced.values()].sort(
      byCountThenName((item) => item.hometown),
    ),
    withoutHometown,
  };
}
