import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const preferenceSchema = z.object({
  pushEnabled: z.boolean(),
  overdueContactEnabled: z.boolean(),
  birthdayEnabled: z.boolean(),
  reminderEnabled: z.boolean(),
  reminderHourLocal: z.number().int().min(0).max(23),
  reminderDaysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
});

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = preferenceSchema.safeParse(await request.json());
    if (!validation.success) return apiError("Invalid notification preferences.");

    const preferences = validation.data;
    const supabase = await createClient();
    // The primary key is id, so the conflict target has to be named
    // explicitly or every save tries to insert a second row for the user.
    const { error } = await supabase.from("notification_preferences").upsert(
      {
        user_id: user.id,
        push_enabled: preferences.pushEnabled,
        overdue_contact_enabled: preferences.overdueContactEnabled,
        birthday_enabled: preferences.birthdayEnabled,
        follow_up_enabled: preferences.reminderEnabled,
        reminder_hour_local: preferences.reminderHourLocal,
        reminder_days_of_week: preferences.reminderDaysOfWeek,
      },
      { onConflict: "user_id" },
    );

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
