import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { interactionLabels } from "@/lib/interaction-labels";
import { createClient } from "@/lib/supabase/server";
import { personUpdateEditSchema } from "@/lib/validation";
import type { InteractionType } from "@/lib/types";

function labelForType(type: InteractionType) {
  return interactionLabels[type] ?? "Update";
}

async function loadOwnedUpdate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("person_updates")
    .select("id,is_interaction")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as { id: string; is_interaction: boolean } | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;
    const validation = personUpdateEditSchema.safeParse(await request.json());
    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid update.");
    }
    const { text, recordedAt, type } = validation.data;

    const supabase = await createClient();
    const existing = await loadOwnedUpdate(supabase, id, user.id);
    if (!existing) return apiError("That update no longer exists.", 404);

    // The interactions rows carry the date reminders are measured from, so they
    // move first. If the second write fails the visible text is simply stale and
    // saving again re-applies both, rather than leaving a reminder pointing at a
    // date the user can no longer see.
    if (existing.is_interaction) {
      const { error: interactionError } = await supabase
        .from("interactions")
        .update({ type, occurred_at: recordedAt, note: text })
        .eq("source_update_id", id)
        .eq("user_id", user.id);
      if (interactionError) return apiError(interactionError.message, 400);
    }

    const { data, error } = await supabase
      .from("person_updates")
      .update({
        text,
        recorded_at: recordedAt,
        ...(existing.is_interaction && { interaction_label: labelForType(type) }),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ update: data });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;
    const supabase = await createClient();
    const existing = await loadOwnedUpdate(supabase, id, user.id);
    if (!existing) return apiError("That update no longer exists.", 404);

    // Interactions go first. The foreign key only nulls source_update_id, so
    // removing the update first would leave its interactions behind as separate
    // timeline entries — the update would look deleted, then reappear.
    const { error: interactionError } = await supabase
      .from("interactions")
      .delete()
      .eq("source_update_id", id)
      .eq("user_id", user.id);
    if (interactionError) return apiError(interactionError.message, 400);

    const { error } = await supabase
      .from("person_updates")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
