import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import {
  maxNoteSectionsPerPerson,
  nextNotePosition,
} from "@/lib/note-sections";
import { createClient } from "@/lib/supabase/server";
import { personNoteInputSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = personNoteInputSchema.safeParse(await request.json());

    if (!validation.success) {
      return apiError(
        validation.error.issues[0]?.message ?? "That section could not be saved.",
      );
    }

    const supabase = await createClient();
    const { data: existing, error: existingError } = await supabase
      .from("person_notes")
      .select("position")
      .eq("person_id", validation.data.personId);

    if (existingError) {
      return apiError(existingError.message, 400);
    }

    if ((existing ?? []).length >= maxNoteSectionsPerPerson) {
      return apiError(
        `You can keep up to ${maxNoteSectionsPerPerson} sections on one person.`,
      );
    }

    const { data, error } = await supabase
      .from("person_notes")
      .insert({
        user_id: user.id,
        person_id: validation.data.personId,
        heading: validation.data.heading,
        body: validation.data.body,
        position: nextNotePosition(existing ?? []),
      })
      .select()
      .single();

    if (error) {
      return apiError(error.message, 400);
    }

    return NextResponse.json({ note: data }, { status: 201 });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
