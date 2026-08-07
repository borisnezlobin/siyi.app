import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { startOfCheckInDay } from "@/lib/daily-check-in";
import { createClient } from "@/lib/supabase/server";

const bodySchema = z.object({ personId: z.string().uuid() });

/**
 * The daily check-in, where a tap is the whole interaction.
 *
 * POST logs that you saw them today, DELETE takes it back. Both are written
 * against the check-in day rather than the calendar day, so the party you log at
 * 1am still counts as last night.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return apiError("That person is not valid.");

    const supabase = await createClient();
    const dayStart = startOfCheckInDay().toISOString();

    // Tapping someone already logged today should not stack up duplicates.
    const { data: existing } = await supabase
      .from("interactions")
      .select("id")
      .eq("user_id", user.id)
      .eq("person_id", parsed.data.personId)
      .gte("occurred_at", dayStart)
      .maybeSingle();

    if (existing) return NextResponse.json({ interaction: existing });

    const { data, error } = await supabase
      .from("interactions")
      .insert({
        user_id: user.id,
        person_id: parsed.data.personId,
        type: "other",
        occurred_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ interaction: data }, { status: 201 });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return apiError("That person is not valid.");

    const supabase = await createClient();
    const { error } = await supabase
      .from("interactions")
      .delete()
      .eq("user_id", user.id)
      .eq("person_id", parsed.data.personId)
      .gte("occurred_at", startOfCheckInDay().toISOString());

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
