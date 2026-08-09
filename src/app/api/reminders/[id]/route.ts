import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Everything is optional so one call can tick a reminder off and another can
 * reword it, without either having to send what it is not changing.
 */
const updateSchema = z
  .object({
    completedAt: z.string().datetime().nullable().optional(),
    text: z.string().trim().min(1, "Add what you want to remember.").max(500).optional(),
    dueAt: z.string().datetime().optional(),
  })
  .refine(
    (value) => Object.keys(value).length > 0,
    "There is nothing to change.",
  );

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;
    const validation = updateSchema.safeParse(await request.json());
    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid reminder.");
    }

    const { completedAt, text, dueAt } = validation.data;
    const patch: Record<string, string | null> = {};
    if (completedAt !== undefined) patch.completed_at = completedAt;
    if (text !== undefined) patch.text = text;
    if (dueAt !== undefined) patch.due_at = dueAt;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reminders")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ reminder: data });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;

    const supabase = await createClient();
    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
