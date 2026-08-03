import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = unsubscribeSchema.safeParse(await request.json());
    if (!validation.success) return apiError("Invalid subscription endpoint.");

    const supabase = await createClient();
    const { error } = await supabase
      .from("push_subscriptions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("endpoint", validation.data.endpoint);

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
