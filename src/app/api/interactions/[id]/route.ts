import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { writeTolerantOfPendingColumns } from "@/lib/pending-columns";
import { createClient } from "@/lib/supabase/server";
import { interactionEditSchema } from "@/lib/validation";

/**
 * Only entries that stand on their own are editable here. An interaction the
 * database created from a multi-person update is kept in step with that update
 * instead, so editing it directly would put the two out of sync.
 */
async function requireStandaloneInteraction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("interactions")
    .select("id,source_update_id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { error: apiError("That update no longer exists.", 404) };
  if (data.source_update_id) {
    return {
      error: apiError(
        "Edit this from the update it belongs to so both stay in step.",
        409,
      ),
    };
  }
  return { error: null };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;
    const validation = interactionEditSchema.safeParse(await request.json());
    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid update.");
    }

    const supabase = await createClient();
    const guard = await requireStandaloneInteraction(supabase, id, user.id);
    if (guard.error) return guard.error;

    const { data, error } = await writeTolerantOfPendingColumns(
      {
        type: validation.data.type,
        occurred_at: validation.data.occurredAt,
        note: validation.data.note,
        custom_label: validation.data.customLabel,
        custom_icon: validation.data.customIcon,
      },
      (row) =>
        supabase
          .from("interactions")
          .update(row)
          .eq("id", id)
          .eq("user_id", user.id)
          .select()
          .single(),
    );

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ interaction: data });
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
    const guard = await requireStandaloneInteraction(supabase, id, user.id);
    if (guard.error) return guard.error;

    const { error } = await supabase
      .from("interactions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
