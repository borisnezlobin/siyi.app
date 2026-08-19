import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import { ameliaConfigured, nameAmeliaPerson } from "@/lib/amelia";

const linkInputSchema = z.object({
  personId: z.string().uuid(),
  ameliaPersonId: z.string().min(1).max(200),
});

const unlinkInputSchema = z.object({
  personId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuthenticatedRequest(request);
    if (!ameliaConfigured()) return apiError("Amelia is not configured.", 503);

    const validation = linkInputSchema.safeParse(await request.json());
    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid link.");
    }
    const { personId, ameliaPersonId } = validation.data;

    const { data: person, error: personError } = await supabase
      .from("people")
      .select("id, full_name, preferred_name")
      .eq("id", personId)
      .single();
    if (personError || !person) return apiError("Person not found.", 404);

    const { error } = await supabase
      .from("person_amelia_links")
      .upsert(
        { person_id: personId, user_id: user.id, amelia_person_id: ameliaPersonId },
        { onConflict: "person_id" },
      );
    if (error) {
      return apiError(
        error.code === "23505"
          ? "That Amelia speaker is already linked to someone else."
          : error.message,
      );
    }

    // Amelia re-files the speaker's past utterances under this name, so the
    // link is also the moment an "Unknown" voice becomes the person you know.
    let nameSynced = true;
    try {
      await nameAmeliaPerson(
        ameliaPersonId,
        person.preferred_name ?? person.full_name,
      );
    } catch {
      nameSynced = false;
    }

    return NextResponse.json({ linked: true, nameSynced }, { status: 201 });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase } = await requireAuthenticatedRequest(request);

    const validation = unlinkInputSchema.safeParse(await request.json());
    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid unlink.");
    }

    const { error } = await supabase
      .from("person_amelia_links")
      .delete()
      .eq("person_id", validation.data.personId);
    if (error) return apiError(error.message);

    return NextResponse.json({ linked: false });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
