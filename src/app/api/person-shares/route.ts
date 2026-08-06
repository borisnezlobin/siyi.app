import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import {
  createShareToken,
  isMissingPersonSharesSchema,
  mapPersonShare,
  shareExpiryFromChoice,
} from "@/lib/person-share";
import { personShareInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const shareColumns =
  "id, person_id, token, fields, expires_at, revoked_at, last_viewed_at, view_count, created_at";

/**
 * Until migration 0015 has been applied there is no table to write to. Saying
 * so plainly lets the share sheet hide the link option and fall back to the
 * vCard file, which is exactly what it did before links existed.
 */
function linksUnavailable() {
  return NextResponse.json({ available: false, shares: [] }, { status: 200 });
}

export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAuthenticatedRequest(request);
    const personId = request.nextUrl.searchParams.get("personId");
    if (!personId) return apiError("A person is required.");

    const { data, error } = await supabase
      .from("person_shares")
      .select(shareColumns)
      .eq("person_id", personId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingPersonSharesSchema(error.code)) return linksUnavailable();
      return apiError(error.message, 400);
    }

    return NextResponse.json({
      available: true,
      shares: (data ?? []).map(mapPersonShare),
    });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuthenticatedRequest(request);
    const validation = personShareInputSchema.safeParse(await request.json());

    if (!validation.success) {
      return apiError(
        validation.error.issues[0]?.message ?? "That link could not be created.",
      );
    }

    const { data, error } = await supabase
      .from("person_shares")
      .insert({
        user_id: user.id,
        person_id: validation.data.personId,
        token: createShareToken((size) => new Uint8Array(randomBytes(size))),
        // The bio is generated on the sharer's device and never stored, so a
        // link can never reproduce it.
        fields: { ...validation.data.selection, bio: false },
        expires_at: shareExpiryFromChoice(validation.data.expiry),
      })
      .select(shareColumns)
      .single();

    if (error) {
      if (isMissingPersonSharesSchema(error.code)) return linksUnavailable();
      return apiError(error.message, 400);
    }

    return NextResponse.json(
      { available: true, share: mapPersonShare(data) },
      { status: 201 },
    );
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
