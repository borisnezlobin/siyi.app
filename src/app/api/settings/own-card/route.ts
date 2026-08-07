import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { normalizeOwnCard, ownCardFields } from "@/lib/own-card";
import { createClient } from "@/lib/supabase/server";

const ownCardSchema = z.object({
  card: z.record(z.enum(ownCardFields), z.string().max(200)).optional(),
  enabled: z.boolean().optional(),
  defaultUniversity: z.string().max(120).nullable().optional(),
});

/** Your own details, and whether adding someone should offer to copy them in. */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = ownCardSchema.safeParse(await request.json());
    if (!validation.success) return apiError("Those details are not valid.");

    const { card, enabled, defaultUniversity } = validation.data;
    const update: Record<string, unknown> = { user_id: user.id };
    if (card !== undefined) update.own_card = normalizeOwnCard(card);
    if (enabled !== undefined) update.own_card_enabled = enabled;
    if (defaultUniversity !== undefined) {
      update.default_university = defaultUniversity?.trim() || null;
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("user_settings")
      .upsert(update, { onConflict: "user_id" });

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
