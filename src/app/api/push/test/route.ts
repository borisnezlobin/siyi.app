import { NextResponse, type NextRequest } from "next/server";
import { brand } from "@/config/brand";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAuthenticatedRequest(request);
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
