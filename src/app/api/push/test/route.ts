import { NextResponse, type NextRequest } from "next/server";
import { brand } from "@/config/brand";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";

export async function POST(request: NextRequest) {
  let user;
  try {
    ({ user } = await requireAuthenticatedRequest(request));
  } catch {
    return apiError("Sign in again to send a test.", 401);
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return apiError("Push is not configured on the server yet.", 503);
  }

  try {
    const admin = createAdminClient();
    const result = await sendPushToUser(admin, user.id, {
      title: `${brand.name} is ready`,
      body: "Test complete. Future reminders will open the right place.",
      url: "/today",
      tag: `test-${user.id}`,
    });

    if (result.delivered > 0) {
      return NextResponse.json({ ok: true, delivered: result.delivered });
    }

    // Separating these tells the person whether to re-enable push on this
    // browser or whether the push service itself rejected the delivery.
    if (result.revoked > 0) {
      return apiError(
        "This browser's subscription expired. Turn push off and on again.",
        409,
      );
    }
    if (result.failed > 0) {
      return apiError(
        "The push service rejected the test. Try again in a moment.",
        502,
      );
    }
    return apiError(
      "No push subscription on this browser yet. Enable push first.",
      409,
    );
  } catch (error) {
    return apiError(errorMessage(error), 500);
  }
}
