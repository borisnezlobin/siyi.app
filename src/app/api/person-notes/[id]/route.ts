import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import {
} from "@/lib/note-sections";
import { createClient } from "@/lib/supabase/server";
import { personNoteEditSchema } from "@/lib/validation";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;
    const validation = personNoteEditSchema.safeParse(await request.json());

    if (!validation.success) {
      return apiError(
        validation.error.issues[0]?.message ?? "That section could not be saved.",
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("person_notes")
      .update({
        heading: validation.data.heading,
        body: validation.data.body,
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return apiError(error.message, 400);
    }

    return NextResponse.json({ note: data });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;

    const supabase = await createClient();
    const { error } = await supabase
      .from("person_notes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return apiError(error.message, 400);
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
