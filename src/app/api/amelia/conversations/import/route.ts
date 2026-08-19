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
 *
 * The import row is claimed before anything side-effecting runs: the unique
 * constraint on amelia_conversation_imports is what makes the import
 * idempotent, so a concurrent duplicate loses the insert and stops there
 * instead of writing a second update. If the update itself then fails, the
 * claim is released so the import can be retried.
 */
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuthenticatedRequest(request);
    if (!ameliaConfigured()) return apiError("Amelia is not configured.", 503);

    const body = await request.json().catch(() => null);
    const validation = importInputSchema.safeParse(body);
    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid import.");
    }
    const { conversationId } = validation.data;

    const { data: claim, error: claimError } = await supabase
      .from("amelia_conversation_imports")
      .insert({ user_id: user.id, amelia_conversation_id: conversationId })
      .select("id")
      .single();
    if (claimError?.code === "23505") {
      return apiError("That conversation is already imported.", 409);
    }
    if (claimError || !claim) {
      console.error("Amelia import claim failed", claimError);
      return apiError("Import failed. Try again.", 500);
    }

    const releaseClaim = () =>
      supabase.from("amelia_conversation_imports").delete().eq("id", claim.id);

    let text;
    let participantIds;
    let startedAt;
    try {
      const summary = await getAmeliaConversation(conversationId);
      text = buildConversationUpdateText(summary);
      participantIds = summary.conversation.participant_ids;
      startedAt = summary.conversation.started_at;
    } catch (ameliaError) {
      console.error("Amelia conversation fetch failed", ameliaError);
      await releaseClaim();
      return apiError("Amelia is unreachable.", 502);
    }

    const { data: links, error: linksError } = await supabase
      .from("person_amelia_links")
      .select("person_id, amelia_person_id");
    if (linksError) {
      console.error("Amelia links read failed", linksError);
      await releaseClaim();
      return apiError("Import failed. Try again.", 500);
    }

    const personIdByAmeliaId = new Map(
      (links ?? []).map((row) => [row.amelia_person_id, row.person_id]),
    );
    const personIds = participantIds
      .map((ameliaId) => personIdByAmeliaId.get(ameliaId))
      .filter((id): id is string => Boolean(id));
    if (!personIds.length) {
      await releaseClaim();
      return apiError(
        "No speaker in that conversation is linked to one of your people yet.",
      );
    }

    const { data: update, error: updateError } = await supabase.rpc(
      "create_person_update",
      {
        person_ids: personIds,
        update_text: text,
        recorded_at: startedAt,
        is_interaction: true,
        interaction_label: "Talked",
        interaction_kind: "talked",
      },
    );
    if (updateError) {
      console.error("Amelia import update failed", updateError);
      await releaseClaim();
      return apiError("Import failed. Try again.", 500);
    }

    const updateId = (update as { id?: string } | null)?.id ?? null;
    if (updateId) {
      const { error: linkBackError } = await supabase
        .from("amelia_conversation_imports")
        .update({ update_id: updateId })
        .eq("id", claim.id);
      if (linkBackError) {
        console.error("Amelia import link-back failed", linkBackError);
      }
    }

    return NextResponse.json({ update, personIds }, { status: 201 });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
