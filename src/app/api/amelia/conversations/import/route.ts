import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import {
  ameliaConfigured,
  buildConversationUpdateText,
  getAmeliaConversation,
} from "@/lib/amelia";

const importInputSchema = z.object({
  conversationId: z.string().min(1).max(200),
});

/**
 * One Amelia conversation becomes one person update shared by every linked
 * speaker, written through create_person_update with is_interaction = true so
 * it lands on each person's timeline and moves their last-contact date — you
 * did actually talk to them.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuthenticatedRequest(request);
    if (!ameliaConfigured()) return apiError("Amelia is not configured.", 503);

    const validation = importInputSchema.safeParse(await request.json());
    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid import.");
    }
    const { conversationId } = validation.data;

    const { data: existing, error: existingError } = await supabase
      .from("amelia_conversation_imports")
      .select("id")
      .eq("amelia_conversation_id", conversationId)
      .maybeSingle();
    if (existingError) return apiError(existingError.message);
    if (existing) return apiError("That conversation is already imported.", 409);

    let summary;
    try {
      summary = await getAmeliaConversation(conversationId);
    } catch {
      return apiError("Amelia is unreachable.", 502);
    }

    const { data: links, error: linksError } = await supabase
      .from("person_amelia_links")
      .select("person_id, amelia_person_id");
    if (linksError) return apiError(linksError.message);

    const personIdByAmeliaId = new Map(
      (links ?? []).map((row) => [row.amelia_person_id, row.person_id]),
    );
    const personIds = summary.conversation.participant_ids
      .map((ameliaId) => personIdByAmeliaId.get(ameliaId))
      .filter((id): id is string => Boolean(id));
    if (!personIds.length) {
      return apiError(
        "No speaker in that conversation is linked to one of your people yet.",
      );
    }

    const { data: update, error: updateError } = await supabase.rpc(
      "create_person_update",
      {
        person_ids: personIds,
        update_text: buildConversationUpdateText(summary),
        recorded_at: summary.conversation.started_at,
        is_interaction: true,
        interaction_label: "Talked",
        interaction_kind: "talked",
      },
    );
    if (updateError) return apiError(updateError.message);

    const updateId =
      update && typeof update === "object" && "id" in update
        ? (update as { id: string }).id
        : null;
    const { error: importError } = await supabase
      .from("amelia_conversation_imports")
      .insert({
        user_id: user.id,
        amelia_conversation_id: conversationId,
        update_id: updateId,
      });
    if (importError && importError.code !== "23505") {
      return apiError(importError.message);
    }

    return NextResponse.json(
      { update, personIds },
      { status: 201 },
    );
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
