import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import {
  createShareToken,
  mapPersonShare,
  shareExpiryFromChoice,
} from "@/lib/person-share";
import { personShareInputSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const shareColumns =
  "id, person_id, token, fields, expires_at, revoked_at, last_viewed_at, view_count, created_at";

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

    // The link carries their surname, so the name has to be read before the row
    // is written. It also confirms the person belongs to this account.
    const { data: person } = await supabase
      .from("people")
      .select("full_name")
      .eq("user_id", user.id)
      .eq("id", validation.data.personId)
      .maybeSingle();

    if (!person) return apiError("That person could not be found.", 404);

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
