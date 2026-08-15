import { NextResponse, type NextRequest } from "next/server";

import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import { isSearchUnavailable, mapSearchResults } from "@/lib/search";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const defaultLimit = 40;
const maxLimit = 200;

/**
 * `available: false` is not `results: []`.
 *
 * Empty means nothing matched; unavailable means `search_everything` is not in
 * the database yet, because migration 0028 is written but applied by hand like
 * every other migration in this project. The caller needs to tell those apart
 * to decide between "no results" and hiding the feature, so the distinction is
 * in the payload rather than in a status code.
 */
export async function GET(request: NextRequest) {
  try {
    // Deployed previews and the e2e run have no database at all. Answering
    // "unavailable" keeps a search box from claiming there is nothing to find.
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ results: [], available: false });
    }

    const { supabase } = await requireAuthenticatedRequest(request);

    const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (!query) return NextResponse.json({ results: [], available: true });

    const requested = Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(requested)
      ? Math.min(Math.max(requested, 1), maxLimit)
      : defaultLimit;

    const { data, error } = await supabase.rpc("search_everything", {
      search_query: query,
      result_limit: limit,
    });

    if (error) {
      if (isSearchUnavailable(error)) {
        return NextResponse.json({ results: [], available: false });
      }
      return apiError(error.message, 400);
    }

    return NextResponse.json({ results: mapSearchResults(data), available: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
