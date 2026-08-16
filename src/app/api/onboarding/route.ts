import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const onboardingSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  timezone: z.string().min(1).max(100),
  locale: z.string().min(2).max(40),
  overdueContactEnabled: z.boolean(),
  birthdayEnabled: z.boolean(),
  reminderEnabled: z.boolean(),
  pushEnabled: z.boolean(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = onboardingSchema.safeParse(await request.json());
    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid setup data.");
    }

    const settings = validation.data;
    const supabase = await createClient();
    const [{ error: profileError }, { error: preferenceError }] = await Promise.all([
      supabase
        .from("user_profiles")
        .update({
          display_name: settings.displayName,
          timezone: settings.timezone,
          locale: settings.locale,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq("auth_user_id", user.id),
      // The primary key is id, so the conflict target has to be named
      // explicitly or this tries to insert a second row for a user who
      // already got one from the signup trigger.
      supabase.from("notification_preferences").upsert(
        {
          user_id: user.id,
          push_enabled: settings.pushEnabled,
          overdue_contact_enabled: settings.overdueContactEnabled,
          birthday_enabled: settings.birthdayEnabled,
          follow_up_enabled: settings.reminderEnabled,
        },
        { onConflict: "user_id" },
      ),
    ]);

    if (profileError || preferenceError) {
      return apiError(profileError?.message ?? preferenceError?.message ?? "Setup failed.", 400);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
