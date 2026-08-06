import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import { getRecentCustomLabels } from "@/lib/data";

/**
 * Fetched only when someone actually opens the "Other" fields. Loading these
 * with the app shell cost a round trip on every single page load for a feature
 * most visits never touch.
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuthenticatedRequest(request);
    return NextResponse.json({ labels: await getRecentCustomLabels() });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
