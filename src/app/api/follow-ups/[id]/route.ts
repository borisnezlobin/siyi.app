import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  completedAt: z.string().datetime().nullable(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;
    const validation = updateSchema.safeParse(await request.json());
    if (!validation.success) {
      return apiError("Invalid completion date.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("follow_ups")
      .update({ completed_at: validation.data.completedAt })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ followUp: data });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
