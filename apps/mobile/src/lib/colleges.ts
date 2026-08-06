import { collegeTable } from "@/lib/colleges-data";

export type College = {
  name: string;
  country: string;
  region: string;
  aliases: string[];
  /** Town, where the source knows it. */
  place: string;
  latitude: number | null;
  longitude: number | null;
};

export function normalizeCollegeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();
}

let parsed: College[] | null = null;
let aliasIndex: Map<string, College> | null = null;

function allColleges(): College[] {
  if (parsed) return parsed;
  parsed = collegeTable.split("\n").map((line) => {
    const [name, country = "", region = "", aliases = "", place = "", lat = "", lon = ""] =
      line.split("\t");
    return {
      name,
      country,
      region,
      aliases: aliases ? aliases.split(",") : [],
      place,
      latitude: lat ? Number(lat) : null,
      longitude: lon ? Number(lon) : null,
    };
  });
  return parsed;
}

function collegesByAlias(): Map<string, College> {
  if (aliasIndex) return aliasIndex;
  aliasIndex = new Map();
  for (const college of allColleges()) {
    for (const alias of college.aliases) {
      if (!aliasIndex.has(alias)) aliasIndex.set(alias, college);
    }
    const normalizedName = normalizeCollegeText(college.name);
    if (!aliasIndex.has(normalizedName)) aliasIndex.set(normalizedName, college);
  }
  return aliasIndex;
}

/**
 * Where a query lands within one school, lowest first. Exact hits beat prefixes,
 * prefixes beat a word start, and a bare substring is the last resort — so "cal"
 * offers Berkeley before California Baptist, and "mit" never offers Madras.
 */
function matchRank(college: College, query: string): number | null {
  const name = normalizeCollegeText(college.name);
  if (college.aliases.includes(query)) return 0;
  if (name === query) return 1;

  // "U.C. Berkeley" normalizes to "u c berkeley", so compare without spaces too,
  // which is also how people write "UCBerkeley" and "Cal Poly" as "calpoly".
  const condensedQuery = query.replace(/ /g, "");
  if (college.aliases.some((alias) => alias.replace(/ /g, "") === condensedQuery)) return 0;
  if (name.replace(/ /g, "") === condensedQuery) return 1;

  if (name.startsWith(query)) return 2;
  if (college.aliases.some((alias) => alias.startsWith(query))) return 3;
  if (name.includes(` ${query}`)) return 4;
  if (name.includes(query)) return 5;
  return null;
}

export function searchColleges(rawQuery: string, limit = 8): College[] {
  const query = normalizeCollegeText(rawQuery);
  if (query.length < 2) return [];

  const scored: { college: College; rank: number }[] = [];
  for (const college of allColleges()) {
    const rank = matchRank(college, query);
    if (rank !== null) scored.push({ college, rank });
  }

  return scored
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.college.name.length - right.college.name.length ||
        left.college.name.localeCompare(right.college.name)
    )
    .slice(0, limit)
    .map((entry) => entry.college);
}

export function findCollege(value: string): College | null {
  const normalized = normalizeCollegeText(value);
  if (!normalized) return null;
  return collegesByAlias().get(normalized) ?? null;
}

/**
 * Every string that should match a stored university, so searching "CMU" finds
 * someone recorded as "Carnegie Mellon University" and vice versa.
 */
export function collegeSearchTerms(university: string | null): string[] {
  if (!university) return [];
  const normalized = normalizeCollegeText(university);
  const college = findCollege(university);
  if (!college) return [normalized];
  return [normalized, normalizeCollegeText(college.name), ...college.aliases];
}

/**
 * A school's own coordinates, when the source has them. Preferred over geocoding
 * its town: it pins the campus rather than the city centre, and never guesses.
 */
export function collegeCoordinates(
  university: string | null
): { latitude: number; longitude: number; label: string } | null {
  const college = university ? findCollege(university) : null;
  if (!college || college.latitude == null || college.longitude == null) return null;
  return {
    latitude: college.latitude,
    longitude: college.longitude,
    label: college.place || college.name,
  };
}

const US_STATE_SUFFIX = /,\s*(US|USA)$/i;

/**
 * Place names worth trying against the geocoder for a school, best guess first.
 * A school's town is usually the last comma-separated part of its name ("…,
 * Berkeley"), and its state is the honest fallback when the town is unknown.
 * Returning several candidates keeps a wrong pin off the map: the caller stops
 * at the first that resolves, and shows the school as unplaced if none do.
 */
export function collegePlaceCandidates(university: string | null): string[] {
  if (!university) return [];
  const college = findCollege(university);
  const name = college?.name ?? university;
  const candidates: string[] = [];

  if (college?.place) candidates.push(college.place);

  const parts = name
    .split(",")
    .map((part) => part.replace(US_STATE_SUFFIX, "").trim())
    .filter(Boolean);
  if (parts.length > 1) {
    const tail = parts[parts.length - 1];
    if (!/^(university|college|institute)/i.test(tail)) candidates.push(tail);
  }

  const dashed = name.split(/\s[-–]\s/).map((part) => part.trim());
  if (dashed.length > 1) candidates.push(dashed[dashed.length - 1]);

  if (college?.region) candidates.push(college.region);

  return [...new Set(candidates.filter((value) => value.length > 1))];
}

export function collegeMatchesQuery(university: string | null, rawQuery: string): boolean {
  const query = normalizeCollegeText(rawQuery);
  if (!query) return true;
  return collegeSearchTerms(university).some((term) => term.includes(query));
}
