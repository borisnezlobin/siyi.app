import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { followUpInputSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = followUpInputSchema.safeParse(await request.json());

    if (!validation.success) {
      return apiError(
        validation.error.issues[0]?.message ?? "Invalid reminder.",
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("follow_ups")
      .insert({
        person_id: validation.data.personId,
        user_id: user.id,
        text: validation.data.text,
        due_at: validation.data.dueAt,
      })
      .select()
      .single();

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ followUp: data }, { status: 201 });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
