import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reminderInputSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = reminderInputSchema.safeParse(await request.json());

    if (!validation.success) {
      return apiError(
        validation.error.issues[0]?.message ?? "Invalid reminder.",
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reminders")
      .insert({
        user_id: user.id,
        text: validation.data.text,
        due_at: validation.data.dueAt,
      })
      .select()
      .single();

    if (error) return apiError(error.message, 400);

    const { error: linkError } = await supabase.from("reminder_people").insert(
      validation.data.personIds.map((personId) => ({
        reminder_id: data.id,
        person_id: personId,
      })),
    );

    // A reminder about nobody is not a reminder. Rather than leave one that
    // nothing will ever surface, take it back out and report the failure.
    if (linkError) {
      await supabase.from("reminders").delete().eq("id", data.id);
      return apiError(linkError.message, 400);
    }

    return NextResponse.json(
      { reminder: { ...data, personIds: validation.data.personIds } },
      { status: 201 },
    );
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
