import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import {
} from "@/lib/note-sections";
import { createClient } from "@/lib/supabase/server";
import { personNoteOrderSchema } from "@/lib/validation";

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = personNoteOrderSchema.safeParse(await request.json());

    if (!validation.success) {
      return apiError("That order could not be saved.");
    }

    const supabase = await createClient();
    const { noteIds, personId } = validation.data;

    for (const [position, noteId] of noteIds.entries()) {
      const { error } = await supabase
        .from("person_notes")
        .update({ position })
        .eq("id", noteId)
        .eq("person_id", personId)
        .eq("user_id", user.id);

      if (error) {
        return apiError(error.message, 400);
      }
    }

    return NextResponse.json({ noteIds });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
