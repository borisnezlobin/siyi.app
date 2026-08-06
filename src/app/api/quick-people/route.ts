import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import { getQuickPeople } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * Only the quick-capture sheet needs the person list, and most visits never
 * open it. Loading it with the app shell put a query on the critical path of
 * every single page load.
 */
export async function GET(request: NextRequest) {
  try {
    // Without Supabase the app runs on demo data and has nobody to authenticate.
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ people: await getQuickPeople() });
    }
    await requireAuthenticatedRequest(request);
    return NextResponse.json({ people: await getQuickPeople() });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
