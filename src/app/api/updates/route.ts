import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import {
  personUpdateInputSchema,
  withPersonIdList,
} from "@/lib/capture-validation";
import { createClient } from "@/lib/supabase/server";

/**
 * An update records something you learned, not that you spoke. It is written
 * with is_interaction = false, so no interactions row appears and the person's
 * last-seen date — and therefore their next reminder — does not move.
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser();
    const validation = personUpdateInputSchema.safeParse(
      withPersonIdList(await request.json()),
    );
    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid update.");
    }

    const { personIds, text, recordedAt } = validation.data;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_person_update", {
      person_ids: personIds,
      update_text: text,
      recorded_at: recordedAt,
      is_interaction: false,
      interaction_label: null,
      interaction_kind: "other",
    });

    if (error) {
      return apiError(
        error.message,
        400,
      );
    }

    return NextResponse.json({ update: data }, { status: 201 });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
