import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { interactionLogSchema, withPersonIdList } from "@/lib/capture-validation";
import { droppingPendingColumns } from "@/lib/pending-columns";
import { createClient } from "@/lib/supabase/server";

/**
 * One call, one interaction per person. Seeing four friends at once is a single
 * evening to the user but four separate answers to "when did I last see them",
 * which is what reminders read.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = interactionLogSchema.safeParse(
      withPersonIdList(await request.json()),
    );
    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid interaction.");
    }

    const { personIds, type, occurredAt, note, customLabel, customIcon } =
      validation.data;
    const supabase = await createClient();
    const rows = personIds.map((personId) => ({
      person_id: personId,
      user_id: user.id,
      type,
      occurred_at: occurredAt,
      note,
      custom_label: customLabel,
      custom_icon: customIcon,
    }));

    let { data, error } = await supabase
      .from("interactions")
      .insert(rows)
      .select();

    // A deploy can land before its migration runs, so a write naming a column
    // the database does not have yet is retried without it.
    if (error && ["42703", "PGRST204"].includes(error.code ?? "")) {
      ({ data, error } = await supabase
        .from("interactions")
        .insert(rows.map(droppingPendingColumns))
        .select());
    }

    if (error) return apiError(error.message, 400);

    const interactions = data ?? [];
    return NextResponse.json(
      { interactions, interaction: interactions[0] ?? null },
      { status: 201 },
    );
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
