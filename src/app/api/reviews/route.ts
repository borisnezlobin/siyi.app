import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reviewInputSchema } from "@/lib/validation";

/**
 * Writing or rewriting your own review.
 *
 * Upsert rather than insert: the table allows one review per account, so
 * someone changing their mind edits theirs instead of being told they already
 * left one. Rewriting returns it to `pending` — a published review that can be
 * silently edited afterwards is not a review anyone should trust.
 *
 * `status` is never read from the request. RLS enforces that too, but the two
 * of them agreeing is the point.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = reviewInputSchema.safeParse(await request.json());

    if (!validation.success) {
      return apiError(
        validation.error.issues[0]?.message ?? "That review could not be saved.",
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .upsert(
        {
          user_id: user.id,
          rating: validation.data.rating,
          body: validation.data.body,
          author_label: validation.data.authorLabel,
          status: "pending",
          published_at: null,
        },
        { onConflict: "user_id" },
      )
      .select("id, rating, body, author_label, status")
      .single();

    if (error) {
      return apiError(error.message, 400);
    }

    return NextResponse.json({ review: data }, { status: 201 });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}

export async function DELETE() {
  try {
    const user = await requireAuthenticatedUser();
    const supabase = await createClient();
    const { error } = await supabase
      .from("reviews")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      return apiError(error.message, 400);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
