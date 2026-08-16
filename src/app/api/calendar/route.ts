import { NextResponse } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createCalendarToken } from "@/lib/calendar-feed";
import { createClient } from "@/lib/supabase/server";

/**
 * Turning the feed on and resetting it are the same request: both write a new
 * token, and both break whatever was subscribed to the old one. That is the
 * point of reset, and for a first turn-on there is nothing to break.
 */
export async function POST() {
  try {
    const user = await requireAuthenticatedUser();
    const token = createCalendarToken((length) =>
      crypto.getRandomValues(new Uint8Array(length)),
    );

    const supabase = await createClient();
    const { error } = await supabase
      .from("user_profiles")
      .update({ calendar_token: token })
      .eq("auth_user_id", user.id);

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ token });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}

export async function DELETE() {
  try {
    const user = await requireAuthenticatedUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("user_profiles")
      .update({ calendar_token: null })
      .eq("auth_user_id", user.id);

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
