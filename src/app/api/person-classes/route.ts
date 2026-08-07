import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { addClassForUser, removeClassForUser } from "@/lib/classes-server";
import { createClient } from "@/lib/supabase/server";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const classSchema = z.object({
  personId: z.string().uuid(),
  courseCode: z.string().trim().min(1, "Add a course code").max(40),
  courseTitle: z.string().trim().max(120).nullish(),
  professor: z.string().trim().max(80).nullish(),
  term: z.string().trim().max(40).nullish(),
  days: z.string().trim().max(14).nullish(),
  startsAt: z.string().regex(timePattern, "Use a time like 10:00").nullish(),
  endsAt: z.string().regex(timePattern, "Use a time like 11:00").nullish(),
  location: z.string().trim().max(120).nullish(),
});

const blankToNull = (value: string | null | undefined) => value?.trim() || null;

/** Classes belong to a person, and a person belongs to exactly one account. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = classSchema.safeParse(await request.json());
    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "That class is not valid.");
    }

    const input = validation.data;
    const supabase = await createClient();

    const { data: person } = await supabase
      .from("people")
      .select("id")
      .eq("user_id", user.id)
      .eq("id", input.personId)
      .maybeSingle();

    if (!person) return apiError("That person could not be found.", 404);

    const created = await addClassForUser(user.id, {
      personId: input.personId,
      courseCode: input.courseCode,
      courseTitle: blankToNull(input.courseTitle),
      professor: blankToNull(input.professor),
      term: blankToNull(input.term),
      days: blankToNull(input.days),
      startsAt: input.startsAt || null,
      endsAt: input.endsAt || null,
      location: blankToNull(input.location),
    });

    if ("error" in created) return apiError(created.error, 400);
    return NextResponse.json({ class: created }, { status: 201 });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const parsed = z
      .object({ id: z.string().uuid() })
      .safeParse(await request.json());
    if (!parsed.success) return apiError("That class is not valid.");

    const failure = await removeClassForUser(user.id, parsed.data.id);
    if (failure) return apiError(failure, 400);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
