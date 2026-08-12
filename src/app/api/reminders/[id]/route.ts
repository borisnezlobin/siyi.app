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
    // Sent whole rather than as additions and removals: the editor knows who
    // the reminder should be about, and a diff would need the client and the
    // server to agree on what it was about first.
    personIds: z
      .array(z.string().uuid())
      .min(1, "Choose who this is about.")
      .max(50, "That is more people than one reminder can hold.")
      .transform((ids) => Array.from(new Set(ids)))
      .optional(),
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

    const { completedAt, text, dueAt, personIds } = validation.data;
    const patch: Record<string, string | null> = {};
    if (completedAt !== undefined) patch.completed_at = completedAt;
    if (text !== undefined) patch.text = text;
    if (dueAt !== undefined) patch.due_at = dueAt;

    const supabase = await createClient();

    // Ticking a reminder off sends only completedAt, so the row still has to be
    // touched even when nothing else changed — and it doubles as the ownership
    // check the people rewrite below relies on.
    const { data, error } = await supabase
      .from("reminders")
      .update(Object.keys(patch).length > 0 ? patch : { updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return apiError(error.message, 400);

    if (personIds) {
      // Added before the departures are removed. The other order can empty the
      // table for a moment, and an empty reminder is one the trigger deletes.
      const { error: addError } = await supabase
        .from("reminder_people")
        .upsert(
          personIds.map((personId) => ({ reminder_id: id, person_id: personId })),
          { onConflict: "reminder_id,person_id" },
        );
      if (addError) return apiError(addError.message, 400);

      const { error: removeError } = await supabase
        .from("reminder_people")
        .delete()
        .eq("reminder_id", id)
        .not("person_id", "in", `(${personIds.join(",")})`);
      if (removeError) return apiError(removeError.message, 400);
    }

    return NextResponse.json({ reminder: { ...data, personIds } });
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
