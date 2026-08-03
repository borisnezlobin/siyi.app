import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { pushSubscriptionSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = pushSubscriptionSchema.safeParse(await request.json());
    if (!validation.success) return apiError("Invalid push subscription.");

    const subscription = validation.data;
    const supabase = await createClient();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        user_agent: request.headers.get("user-agent") ?? "",
        last_used_at: new Date().toISOString(),
        revoked_at: null,
      },
      { onConflict: "user_id,endpoint" },
    );

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
