import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { interactionInputSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = interactionInputSchema.safeParse(await request.json());
    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid interaction.");
    }

    const interaction = validation.data;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("interactions")
      .insert({
        person_id: interaction.personId,
        user_id: user.id,
        type: interaction.type,
        occurred_at: interaction.occurredAt,
        note: interaction.note,
      })
      .select()
      .single();

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ interaction: data }, { status: 201 });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
