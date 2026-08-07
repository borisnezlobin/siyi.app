import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { normalizeOwnCard, ownCardLabels, type OwnCardField } from "@/lib/own-card";
import { createClient } from "@/lib/supabase/server";

/**
 * The card is a plain string map rather than a record keyed by the field enum:
 * that form of `z.record` requires every key to be present, so a card with eight
 * of the twelve fields filled in was rejected as invalid. Unknown keys are
 * dropped by `normalizeOwnCard` regardless.
 */
const ownCardSchema = z.object({
  card: z.record(z.string(), z.string().max(200, "Keep it under 200 characters")).optional(),
  enabled: z.boolean().optional(),
  defaultUniversity: z.string().max(120).nullable().optional(),
});

/** "Email: keep it under 200 characters" beats "those details are not valid". */
function describeIssue(issue: z.core.$ZodIssue) {
  const key = issue.path[1] ?? issue.path[0];
  const label = ownCardLabels[key as OwnCardField];
  return label ? `${label}: ${issue.message}` : issue.message;
}

/** Your own details, and whether adding someone should offer to copy them in. */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = ownCardSchema.safeParse(await request.json());
    if (!validation.success) {
      const issue = validation.error.issues[0];
      return apiError(
        issue ? describeIssue(issue) : "Those details could not be saved.",
      );
    }

    const { card, enabled, defaultUniversity } = validation.data;
    const supabase = await createClient();
    const update: Record<string, unknown> = { user_id: user.id };

    if (card !== undefined) update.own_card = normalizeOwnCard(card);

    if (enabled !== undefined) update.own_card_enabled = enabled;
    if (defaultUniversity !== undefined) {
      update.default_university = defaultUniversity?.trim() || null;
    }

    const { error } = await supabase
      .from("user_settings")
      .upsert(update, { onConflict: "user_id" });

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
