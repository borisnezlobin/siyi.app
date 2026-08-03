import { NextResponse } from "next/server";
import { brand } from "@/config/brand";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";

export async function POST() {
  try {
    const user = await requireAuthenticatedUser();
    const admin = createAdminClient();
    const result = await sendPushToUser(admin, user.id, {
      title: `${brand.name} is ready`,
      body: "Test complete. Future reminders will open the right place.",
      url: "/today",
      tag: `test-${user.id}`,
    });

    if (result.delivered === 0) {
      return apiError("No active subscription could receive the test.", 409);
    }

    return NextResponse.json({ ok: true, delivered: result.delivered });
  } catch (error) {
    return apiError(errorMessage(error), 500);
  }
}
