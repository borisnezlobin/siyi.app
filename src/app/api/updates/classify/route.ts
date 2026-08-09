import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import { geminiConfigured, sortUpdateWithGemini } from "@/lib/gemini";
import { buildProposalContext, proposalInstructions } from "@/lib/update-proposal";

/**
 * Sorting one typed update into the places it belongs.
 *
 * Nothing is written here — the answer is a proposal the person still has to
 * approve. Authentication is the bearer-capable kind, because the phone calls
 * this too whenever it has no model of its own.
 *
 * Having no model is a supported state, not an error: an absent key answers 200
 * with a null proposal, and the caller saves a plain update exactly as before.
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

    const body = (await request.json()) as { personId?: unknown; text?: unknown };
    const personId = typeof body.personId === "string" ? body.personId : "";
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!personId || !text) return apiError("Nothing to sort.");
    if (text.length > 2000) return apiError("That update is too long to sort.");

    if (!geminiConfigured()) {
      return NextResponse.json({ proposal: null, reason: "unavailable" });
    }

    // One key serves everybody, so one person holding the button would spend
    // the whole account's allowance.
    if (!withinRate(user.id, Date.now())) {
      return NextResponse.json({ proposal: null, reason: "rate-limited" });
    }

    // The contact columns are read for the answer, never for the prompt:
    // `buildProposalContext` does not name a contact field at all, so what the
    // model is told stays the same whether or not they are filled. The browser
    // needs them to say "this would replace the number you already have".
    const { data: person } = await supabase
      .from("people")
      .select(
        "full_name, preferred_name, hometown, university, major, graduation_year, birthday, dorm_or_residence, first_met_location, relationship_label, phone_number, email, instagram_username",
      )
      .eq("id", personId)
      .maybeSingle();

    if (!person) return apiError("That person could not be found.", 404);

    const { data: notes } = await supabase
      .from("person_notes")
      .select("id, heading, body")
      .eq("person_id", personId)
      .order("position", { ascending: true });

    // The bodies are for the browser, which needs them to append rather than
    // replace. `buildProposalContext` reads headings only, so what a section
    // already says never reaches the model.
    const sections = (notes ?? []).map((note) => ({
      id: note.id as string,
      heading: note.heading as string,
      body: (note.body as string | null) ?? "",
    }));

    const snapshot = {
      fullName: person.full_name as string,
      preferredName: person.preferred_name as string | null,
      hometown: person.hometown as string | null,
      university: person.university as string | null,
      major: person.major as string | null,
      graduationYear: person.graduation_year as number | null,
      birthday: person.birthday as string | null,
      dormOrResidence: person.dorm_or_residence as string | null,
      firstMetLocation: person.first_met_location as string | null,
      relationshipLabel: person.relationship_label as string | null,
    };

    const result = await sortUpdateWithGemini({
      instructions: proposalInstructions(),
      context: buildProposalContext({ person: snapshot, sections, now: new Date() }),
      text,
    });

    // Every value of each kind, not just the primary: a second email is only
    // worth offering if they do not already have it.
    const { data: contactRows } = await supabase
      .from("person_contact_methods")
      .select("kind, value")
      .eq("person_id", personId);

    const contact: Record<string, string[]> = {};
    for (const row of contactRows ?? []) {
      const kind = row.kind as string;
      contact[kind] = [...(contact[kind] ?? []), row.value as string];
    }
    // The single columns still hold the primary of each kind on accounts that
    // have not written a contact row yet.
    for (const [kind, legacy] of [
      ["phone", person.phone_number],
      ["email", person.email],
      ["instagram", person.instagram_username],
    ] as const) {
      const value = legacy as string | null;
      if (value && !(contact[kind] ?? []).includes(value)) {
        contact[kind] = [...(contact[kind] ?? []), value];
      }
    }

    const { data: classRows } = await supabase
      .from("person_classes")
      .select("course_code")
      .eq("person_id", personId);

    return NextResponse.json({
      ...result,
      person: snapshot,
      sections,
      contact,
      classes: (classRows ?? []).map((row) => row.course_code as string),
    });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
