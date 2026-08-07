import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/**
 * Revoking stamps revoked_at rather than deleting the row, so the sharer keeps
 * a record that the link existed. Either way the next viewer is refused: the
 * resolver checks revoked_at before it reads the person.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase } = await requireAuthenticatedRequest(request);
    const { id } = await params;

    const { error } = await supabase
      .from("person_shares")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
      .is("revoked_at", null);

    if (error) {
      return apiError(error.message, 400);
    }

    return NextResponse.json({ available: true, revoked: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
