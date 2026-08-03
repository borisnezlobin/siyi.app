import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const settingsSchema = z.object({
  timezone: z.string().min(1).max(100),
  reminderIntervals: z.object({
    "1": z.number().int().min(1).max(3650),
    "2": z.number().int().min(1).max(3650),
    "3": z.number().int().min(1).max(3650),
    "4": z.number().int().min(1).max(3650),
  }),
});

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = settingsSchema.safeParse(await request.json());
    if (!validation.success) return apiError("Invalid settings.");

    const { timezone, reminderIntervals } = validation.data;
    const supabase = await createClient();
    const [{ error: profileError }, { error: settingsError }] = await Promise.all([
      supabase
        .from("user_profiles")
        .update({ timezone })
        .eq("auth_user_id", user.id),
      supabase.from("user_settings").upsert({
        user_id: user.id,
        strength_1_days: reminderIntervals[1],
        strength_2_days: reminderIntervals[2],
        strength_3_days: reminderIntervals[3],
        strength_4_days: reminderIntervals[4],
      }),
    ]);

    if (profileError || settingsError) {
      return apiError(profileError?.message ?? settingsError?.message ?? "Settings failed.");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
