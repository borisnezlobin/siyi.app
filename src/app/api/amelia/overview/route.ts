import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import {
  ameliaConfigured,
  getAmeliaConversations,
  getAmeliaPeople,
} from "@/lib/amelia";

/**
 * Everything the Amelia card on a person page needs in one round trip: whether
 * this person is linked to an Amelia speaker, the Amelia people available to
 * link, and the conversations that speaker took part in, flagged with whether
 * they were already imported.
 */
export async function GET(request: NextRequest) {
  try {
    const { supabase } = await requireAuthenticatedRequest(request);
    if (!ameliaConfigured()) {
      return NextResponse.json({ configured: false });
    }

    const personIdValidation = z
      .string()
      .uuid()
      .safeParse(request.nextUrl.searchParams.get("personId"));
    if (!personIdValidation.success) {
      return apiError("personId must be a person id.");
    }
    const personId = personIdValidation.data;

    const [linksResult, importsResult] = await Promise.all([
      supabase
        .from("person_amelia_links")
        .select("person_id, amelia_person_id"),
      supabase
        .from("amelia_conversation_imports")
        .select("amelia_conversation_id"),
    ]);
    if (linksResult.error || importsResult.error) {
      console.error(
        "Amelia overview read failed",
        linksResult.error ?? importsResult.error,
      );
      return apiError("Loading Amelia data failed. Try again.", 500);
    }

    let people;
    let conversations;
    try {
      [people, conversations] = await Promise.all([
        getAmeliaPeople(),
        getAmeliaConversations(),
      ]);
    } catch (ameliaError) {
      // Amelia being down should read as a quiet state on the person page,
      // not an error toast — the link data is still real.
      console.error("Amelia overview fetch failed", ameliaError);
      return NextResponse.json({ configured: true, reachable: false });
    }

    const links = linksResult.data ?? [];
    const linkedAmeliaIds = new Set(links.map((row) => row.amelia_person_id));
    const importedIds = new Set(
      (importsResult.data ?? []).map((row) => row.amelia_conversation_id),
    );
    const link =
      links.find((row) => row.person_id === personId) ?? null;
    const nameById = new Map(people.map((person) => [person._id, person.name]));

    const personConversations = link
      ? conversations
          .filter((conversation) =>
            conversation.participant_ids.includes(link.amelia_person_id),
          )
          .map((conversation) => ({
            id: conversation._id,
            title: conversation.title ?? null,
            startedAt: conversation.started_at,
            endedAt: conversation.ended_at ?? null,
            participants: conversation.participant_ids.map(
              (id) => nameById.get(id) ?? "Unknown speaker",
            ),
            imported: importedIds.has(conversation._id),
          }))
      : [];

    return NextResponse.json({
      configured: true,
      reachable: true,
      link: link ? { ameliaPersonId: link.amelia_person_id } : null,
      people: people
        .filter((person) => !person.is_owner)
        .map((person) => ({
          id: person._id,
          name: person.name,
          linked: linkedAmeliaIds.has(person._id),
        })),
      conversations: personConversations,
    });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
