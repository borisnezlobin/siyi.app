import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import { geminiConfigured, writeWithGemini } from "@/lib/gemini";

/**
 * Something to open with, for someone you have not spoken to in a while.
 *
 * The heuristics this replaces could only ever rearrange the fields into a
 * sentence — "Ask how Chemistry is going" — because they had nothing to read.
 * A model can use the notes.
 *
 * Having no model is a supported state, not an error: an absent key answers 200
 * with nothing, and the caller keeps the written-out suggestions it already had.
 */

const perUserPerMinute = 10;
const recentCalls = new Map<string, number[]>();

function withinRate(userId: string, now: number) {
  const since = now - 60_000;
  const calls = (recentCalls.get(userId) ?? []).filter((at) => at > since);
  if (calls.length >= perUserPerMinute) return false;
  calls.push(now);
  recentCalls.set(userId, calls);
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuthenticatedRequest(request);
    const body = (await request.json()) as { personId?: unknown };
    const personId = typeof body.personId === "string" ? body.personId : "";
    if (!personId) return apiError("Choose someone first.");

    if (!geminiConfigured()) return NextResponse.json({ starters: [] });
    if (!withinRate(user.id, Date.now())) return NextResponse.json({ starters: [] });

    // Contact details are not selected, so they cannot travel. What is useful
    // here is what you wrote down about them, not how to reach them.
    const { data: person } = await supabase
      .from("people")
      .select(
        "full_name, preferred_name, university, major, graduation_year, hometown, first_met_location, relationship_label, general_notes, last_interaction_at",
      )
      .eq("id", personId)
      .maybeSingle();
    if (!person) return apiError("That person could not be found.", 404);

    const { data: notes } = await supabase
      .from("person_notes")
      .select("heading, body")
      .eq("person_id", personId)
      .order("position", { ascending: true });

    const name = (person.preferred_name as string | null) || (person.full_name as string);
    const context = [
      `Their name: ${name}`,
      person.relationship_label ? `How you know them: ${person.relationship_label}` : null,
      person.university ? `Studies at: ${person.university}` : null,
      person.major ? `Studies: ${person.major}` : null,
      person.hometown ? `From: ${person.hometown}` : null,
      person.first_met_location ? `You met at: ${person.first_met_location}` : null,
      person.general_notes ? `Notes: ${person.general_notes}` : null,
      ...(notes ?? [])
        .filter((note) => (note.body as string | null)?.trim())
        .map((note) => `${note.heading}: ${note.body}`),
    ]
      .filter(Boolean)
      .join("\n");

    const starters = await writeWithGemini({
      instructions: [
        "You suggest ways to start a conversation with a friend somebody has not spoken to in a while.",
        "Use only what you are told about them. Never invent a fact.",
        "Each one is under twelve words, and reads as something a person would actually say.",
        "No guilt, no pressure, no apologising for the gap, no romantic assumptions.",
        "Return exactly three, one per line, with nothing else.",
      ].join("\n"),
      prompt: `About one person:\n${context}`,
    });

    return NextResponse.json({ starters });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
