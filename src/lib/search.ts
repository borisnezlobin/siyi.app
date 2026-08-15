/**
 * Searching everything, not just names.
 *
 * `people-filters.ts` and `person-search.ts` both match over people the client
 * already holds. That is the right design for a picker and the wrong one for
 * search: the thing you have forgotten the name of is findable only by what you
 * wrote about it, and most of what you wrote lives in updates, notes and
 * classes rather than on the person row.
 *
 * The ranking is Postgres's (`search_everything`, migration 0028). Everything
 * here is shaping: naming the columns, grouping by person, and cutting a
 * snippet around the words that matched.
 */

export const searchResultKinds = [
  "person",
  "update",
  "note",
  "interaction",
  "class",
  "reminder",
] as const;

export type SearchResultKind = (typeof searchResultKinds)[number];

export type SearchResult = {
  kind: SearchResultKind;
  recordId: string;
  personIds: string[];
  title: string | null;
  snippet: string | null;
  occurredAt: string | null;
  rank: number;
};

/** The row shape `search_everything` returns, before naming. */
export type SearchResultRow = {
  kind: string | null;
  record_id: string | null;
  person_ids: string[] | null;
  title: string | null;
  snippet: string | null;
  occurred_at: string | null;
  rank: number | null;
};

function isSearchResultKind(value: string | null): value is SearchResultKind {
  return value !== null && (searchResultKinds as readonly string[]).includes(value);
}

/**
 * A row with no id or an unknown kind is dropped rather than rendered as a
 * result that navigates nowhere. The function is versioned with the client, so
 * this only happens when a newer database answers an older app — during a
 * rolling deploy, in other words, where showing four of five results is a much
 * better failure than a broken link.
 */
export function mapSearchResults(rows: readonly SearchResultRow[] | null): SearchResult[] {
  if (!rows) return [];

  const results: SearchResult[] = [];

  for (const row of rows) {
    if (!row.record_id || !isSearchResultKind(row.kind)) continue;

    results.push({
      kind: row.kind,
      recordId: row.record_id,
      personIds: (row.person_ids ?? []).filter((id): id is string => typeof id === "string"),
      title: row.title?.trim() ? row.title : null,
      snippet: row.snippet?.trim() ? row.snippet : null,
      occurredAt: row.occurred_at,
      rank: typeof row.rank === "number" ? row.rank : 0,
    });
  }

  return results;
}

/**
 * Search is unavailable, as opposed to empty, when migration 0028 has not run.
 *
 * `42883` is Postgres for "no such function" and `PGRST202` is PostgREST
 * failing to find it in the schema cache; `42P01` covers a table the function
 * reads being absent too. This mirrors the read-side convention in `data.ts`,
 * where a missing column returns empty instead of throwing — the feature stays
 * hidden until its migration is applied, and nothing else breaks.
 */
export function isSearchUnavailable(error: { code?: string | null } | null): boolean {
  if (!error?.code) return false;
  return error.code === "42883" || error.code === "PGRST202" || error.code === "42P01";
}

const defaultSnippetLength = 180;

/**
 * A window of the text around the first word that matched, so the result shows
 * the sentence rather than whichever 180 characters happen to come first.
 *
 * Matching here is deliberately looser than the tsquery that selected the row:
 * this only decides where to cut, so a near miss costs a slightly worse window
 * and never a wrong result. Stemming means the database can match "moving" on
 * a search for "move" and no substring of the text equals the query — that is
 * the case the length check at the end falls back for.
 */
export function snippetAround(
  text: string | null,
  query: string,
  maxLength: number = defaultSnippetLength,
): string {
  if (!text) return "";

  const collapsed = text.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;

  const words = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 1);

  const haystack = collapsed.toLowerCase();
  let found = -1;

  for (const word of words) {
    const at = haystack.indexOf(word);
    if (at !== -1 && (found === -1 || at < found)) found = at;
  }

  if (found === -1) return `${collapsed.slice(0, maxLength).trimEnd()}…`;

  // Centre the window on the match, then pull it back inside the string. Doing
  // it in this order means a match near either end still yields a full-length
  // snippet rather than a short one padded with nothing.
  const half = Math.floor((maxLength - 1) / 2);
  const start = Math.max(0, Math.min(found - half, collapsed.length - maxLength));
  const end = Math.min(collapsed.length, start + maxLength);

  const prefix = start > 0 ? "…" : "";
  const suffix = end < collapsed.length ? "…" : "";

  return `${prefix}${collapsed.slice(start, end).trim()}${suffix}`;
}

export type PersonGroup<TPerson> = {
  person: TPerson;
  results: SearchResult[];
  rank: number;
};

export type SearchGrouping<TPerson> = {
  people: PersonGroup<TPerson>[];
  /** Matches that name nobody — an update or reminder with no person attached. */
  loose: SearchResult[];
};

/**
 * Grouped by person, because "everything I know about Maya" is what the list is
 * for, and six kinds interleaved by rank reads as noise.
 *
 * A result naming several people appears under each of them. It is one record
 * seen from two sides rather than a duplicate, and hiding it from one person's
 * group would make that person's page quietly incomplete.
 */
export function groupResultsByPerson<TPerson extends { id: string }>(
  results: readonly SearchResult[],
  people: readonly TPerson[],
): SearchGrouping<TPerson> {
  const peopleById = new Map(people.map((person) => [person.id, person]));
  const groups = new Map<string, PersonGroup<TPerson>>();
  const loose: SearchResult[] = [];

  for (const result of results) {
    // A person result that somehow outlived its person would otherwise open a
    // group with nothing to name it.
    const known = result.personIds.filter((id) => peopleById.has(id));

    if (known.length === 0) {
      loose.push(result);
      continue;
    }

    for (const personId of known) {
      const existing = groups.get(personId);

      if (existing) {
        existing.results.push(result);
        existing.rank = Math.max(existing.rank, result.rank);
        continue;
      }

      groups.set(personId, {
        person: peopleById.get(personId) as TPerson,
        results: [result],
        rank: result.rank,
      });
    }
  }

  return {
    people: [...groups.values()].sort((a, b) => b.rank - a.rank),
    loose,
  };
}
