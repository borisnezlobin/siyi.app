import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Regenerates the bundled college list behind the university autocomplete, people
// search ("CMU" finds Carnegie Mellon) and the college map. Run with:
//   node scripts/build-college-dataset.mjs
//
// Two sources, no hand-written school lists:
//   * Hipo's world university list  - names and countries, worldwide.
//   * US College Scorecard          - official aliases, town, coordinates and
//                                     enrollment for US schools.
// The result is committed so neither app makes a network call to resolve a school.
//
// Scorecard is rate limited to ~30 requests/hour on the shared demo key and needs
// 63. Set SCORECARD_KEY to a free key from https://api.data.gov/signup/ to pull it
// in one go. A cached scorecard.json next to this script is used when present.

const WORLD_SOURCE =
  "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json";
const SCORECARD_FIELDS =
  "school.name,school.alias,school.city,school.state,location.lat,location.lon,latest.student.size";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scorecardCache = join(repoRoot, "scripts", "scorecard.json");

// Words that never contribute a letter to an acronym, so "University of
// California" yields UC rather than UOC.
const ACRONYM_STOP_WORDS = new Set([
  "of", "the", "and", "at", "for", "in", "de", "del", "la", "los", "las", "el",
]);

function normalize(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();
}

// Scorecard writes campuses as "University of Virginia-Main Campus" where the
// world list says "University of Virginia, Charlottesville". Without folding the
// campus wording away the two stay separate rows, and the well-known school ends
// up with no size, no coordinates and no claim on its own acronym.
function mergeKey(name) {
  return normalize(name)
    .replace(/\bmain campus\b/g, "")
    .replace(/\ball campuses\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function acronymFor(name) {
  const words = name
    .split(/[,(]/)[0]
    .split(/[\s\-–—]+/)
    .map((word) => word.replace(/[^A-Za-z&]/g, ""))
    .filter(Boolean)
    .filter((word) => !ACRONYM_STOP_WORDS.has(word.toLowerCase()));

  if (words.length < 2 || words.length > 6) return null;
  const letters = words.map((word) => word[0].toUpperCase()).join("");
  return letters.length >= 2 && letters.length <= 6 ? letters.toLowerCase() : null;
}

async function loadScorecard() {
  const key = process.env.SCORECARD_KEY;
  if (!key) {
    if (existsSync(scorecardCache)) {
      const cached = JSON.parse(readFileSync(scorecardCache, "utf8"));
      console.log(`using cached scorecard.json (${cached.length} US schools)`);
      return cached;
    }
    console.log("no SCORECARD_KEY and no cache: building without US enrichment");
    return [];
  }

  const results = [];
  for (let page = 0; page < 70; page++) {
    const url = `https://api.data.gov/ed/collegescorecard/v1/schools?api_key=${key}&fields=${SCORECARD_FIELDS}&per_page=100&page=${page}&school.operating=1`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Scorecard page ${page}: HTTP ${response.status}`);
    const json = await response.json();
    if (json.results.length === 0) break;
    results.push(...json.results);
  }
  writeFileSync(scorecardCache, JSON.stringify(results));
  console.log(`pulled ${results.length} US schools from College Scorecard`);
  return results;
}

const worldResponse = await fetch(WORLD_SOURCE);
if (!worldResponse.ok) {
  throw new Error(`Could not download the world college list: HTTP ${worldResponse.status}`);
}
const world = await worldResponse.json();
const scorecard = await loadScorecard();

const colleges = new Map();
for (const entry of world) {
  const name = entry.name?.trim();
  if (!name || colleges.has(mergeKey(name))) continue;
  colleges.set(mergeKey(name), {
    name,
    country: entry.alpha_two_code ?? "",
    region: entry["state-province"]?.trim() ?? "",
    place: "",
    latitude: null,
    longitude: null,
    enrollment: 0,
    aliases: new Set(),
  });
}

// Scorecard is authoritative for US schools: it carries the aliases people
// actually type, the town, exact coordinates and enrollment.
for (const school of scorecard) {
  const name = school["school.name"]?.trim();
  if (!name) continue;
  const key = mergeKey(name);
  const existing = colleges.get(key);
  const city = school["school.city"]?.trim() ?? "";
  const state = school["school.state"]?.trim() ?? "";

  const college = existing ?? {
    name,
    country: "US",
    region: state,
    place: "",
    latitude: null,
    longitude: null,
    enrollment: 0,
    aliases: new Set(),
  };

  college.region = state || college.region;
  college.place = city && state ? `${city}, ${state}` : city || college.place;
  college.latitude = school["location.lat"] ?? college.latitude;
  college.longitude = school["location.lon"] ?? college.longitude;
  college.enrollment = school["latest.student.size"] ?? 0;

  for (const alias of (school["school.alias"] ?? "").split(";")) {
    const cleaned = normalize(alias);
    if (cleaned && cleaned !== key) college.aliases.add(cleaned);
  }

  colleges.set(key, college);
}

// Every school proposes its official aliases and its acronym, and each alias then
// goes to whichever claimant is biggest. Enrollment decides, not spelling: that is
// what sends "mit" to Massachusetts rather than Madras, and stops a 200-student
// college keeping "ucb" away from Berkeley just because it registered it
// officially. Schools with no enrollment figure only take an alias nobody wants.
// A name the school actually goes by counts for more than one this script
// invented from its initials — but not infinitely more, or a 900-student college
// that registered "UCB" keeps it from the Berkeley thirty times its size. Worth
// about a tripling, which is enough for Carnegie Mellon to hold "CMU" against a
// larger Central Michigan, and not enough for the small cases to win.
const OFFICIAL_ALIAS_WEIGHT = 3;

function strengthOf(college, official) {
  return Math.max(college.enrollment, 1) * (official ? OFFICIAL_ALIAS_WEIGHT : 1);
}

const claims = new Map();
function claim(alias, college, official) {
  const holder = claims.get(alias);
  if (!holder) {
    claims.set(alias, { college, official });
    return;
  }
  if (strengthOf(college, official) > strengthOf(holder.college, holder.official)) {
    claims.set(alias, { college, official });
  }
}

for (const college of colleges.values()) {
  for (const alias of college.aliases) claim(alias, college, true);
  const acronym = acronymFor(college.name);
  if (acronym) claim(acronym, college, false);
}

for (const college of colleges.values()) college.aliases = new Set();
for (const [alias, holder] of claims) holder.college.aliases.add(alias);

const sorted = [...colleges.values()].sort((left, right) => left.name.localeCompare(right.name));

// One tab-separated line per school, kept as a single string so the bundler ships
// text rather than a large object literal, and nothing is parsed until first use.
const table = sorted
  .map((college) =>
    [
      college.name,
      college.country,
      college.region,
      [...college.aliases].join(","),
      college.place,
      college.latitude === null ? "" : String(college.latitude),
      college.longitude === null ? "" : String(college.longitude),
      college.enrollment ? String(college.enrollment) : "",
    ]
      .join("\t")
      .replace(/\t+$/, "")
  )
  .join("\n");

const body = `// Generated by scripts/build-college-dataset.mjs. Do not edit by hand.
// Sources: ${WORLD_SOURCE}
//          US College Scorecard (api.data.gov) for aliases, towns and coordinates.
// ${sorted.length} schools, one per line: name, country, region, aliases, town, lat, lon, size.

export const collegeTable = ${JSON.stringify(table)};
`;

for (const target of ["src/lib/colleges-data.ts", "apps/mobile/src/lib/colleges-data.ts"]) {
  writeFileSync(join(repoRoot, target), body);
  console.log(`wrote ${target}`);
}

const withCoordinates = sorted.filter((college) => college.latitude !== null).length;
const withAliases = sorted.filter((college) => college.aliases.size > 0).length;
console.log(
  `${sorted.length} schools, ${withAliases} with aliases, ${withCoordinates} with coordinates, ${(body.length / 1024).toFixed(0)}KB per copy`
);
