import { isOnline } from "@/lib/offline-store";
import { supabase } from "@/lib/supabase";
import { isSearchUnavailable, mapSearchResults, type SearchResult } from "@/lib/search";

/**
 * Search is the one read in this app that does not answer from the snapshot.
 *
 * The whole corpus is already on the device, so matching locally is possible —
 * and it would mean a second implementation of the ranking `search_everything`
 * already does, drifting from the web's results the first time either side is
 * tuned. One ranking, in the database, is worth needing a connection for.
 *
 * So there is no offline fallback here. Being told search needs a connection is
 * honest; being quietly given worse results ordered differently from the web is
 * not, and neither is a name-only match dressed up as the same feature.
 */
export type SearchOutcome =
  | { status: "ready"; results: SearchResult[] }
  | { status: "unavailable" }
  | { status: "offline" };

const defaultLimit = 40;

export async function searchEverything(
  query: string,
  limit: number = defaultLimit,
): Promise<SearchOutcome> {
  const trimmed = query.trim();
  if (!trimmed) return { status: "ready", results: [] };

  if (!(await isOnline())) return { status: "offline" };

  const { data, error } = await supabase.rpc("search_everything", {
    search_query: trimmed,
    result_limit: limit,
  });

  if (error) {
    // Migration 0028 has not been applied yet. The feature hides itself rather
    // than reporting an error nobody using the app can act on.
    if (isSearchUnavailable(error)) return { status: "unavailable" };
    throw new Error(error.message);
  }

  return { status: "ready", results: mapSearchResults(data) };
}
