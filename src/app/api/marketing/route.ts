import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const marketingSchema = z.object({
  marketingOptIn: z.boolean(),
});

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = marketingSchema.safeParse(await request.json());
    if (!validation.success) return apiError("Invalid marketing preference.");

    const { marketingOptIn } = validation.data;
    const supabase = await createClient();
    const { error } = await supabase.from("user_profiles").upsert(
      {
        auth_user_id: user.id,
        email: user.email ?? "",
        marketing_opt_in: marketingOptIn,
        marketing_opt_in_at: marketingOptIn ? new Date().toISOString() : null,
      },
      { onConflict: "auth_user_id" },
    );

    if (error) return apiError(error.message);
    return NextResponse.json({ ok: true, marketingOptIn });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
