import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { adminSegments, segmentCounts } from "@/lib/admin";
import { adminNotFound, resolveAdminRequest } from "@/lib/admin-access";
import { getAdminUserFacts, summariseUsers } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await resolveAdminRequest(request);
  if (!admin) return adminNotFound();

  try {
    const facts = await getAdminUserFacts();
    const counts = segmentCounts(facts);

    return NextResponse.json({
      stats: summariseUsers(facts),
      segments: adminSegments.map(({ id, label, description }) => ({
        id,
        label,
        description,
        users: counts[id] ?? 0,
      })),
    });
  } catch (error) {
    return apiError(errorMessage(error), 500);
  }
}
