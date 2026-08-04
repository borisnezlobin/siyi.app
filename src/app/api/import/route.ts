import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";
import { isOwnedAvatarReference } from "@/lib/avatar-urls";
import { importPayloadSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await requireAuthenticatedRequest(request);
    const rawPayload = await request.json().catch(() => null);
    if (!rawPayload) {
      return apiError("Choose a valid JSON export file.", 400);
    }
    const validation = importPayloadSchema.safeParse(rawPayload);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      return apiError(
        `Invalid ${issue.path.join(".") || "import"}: ${issue.message}`,
      );
    }

    const payload = validation.data;
    const personIdMap = new Map<string, string>();
    const tagIdMap = new Map<string, string>();

    for (const person of payload.people) {
      const targetId = person.id ?? crypto.randomUUID();
      if (person.id) personIdMap.set(person.id, targetId);

      const { error } = await supabase.from("people").upsert({
        id: targetId,
        user_id: user.id,
        full_name: person.fullName,
        preferred_name: person.preferredName,
        profile_photo_url: isOwnedAvatarReference(
          person.profilePhotoUrl,
          user.id,
        )
          ? person.profilePhotoUrl
          : null,
        instagram_username: person.instagramUsername,
        phone_number: person.phoneNumber,
        email: person.email,
        birthday: person.birthday,
        hometown: person.hometown,
        dorm_or_residence: person.dormOrResidence,
        major: person.major,
        graduation_year: person.graduationYear,
        relationship_strength: person.relationshipStrength,
        reminder_interval_days: person.reminderIntervalDays,
        status: person.status,
        first_met_at: person.firstMetAt ?? new Date().toISOString(),
        first_met_location: person.firstMetLocation,
        general_notes: person.generalNotes,
      });
      if (error) return apiError(error.message, 400);
    }

    for (const tag of payload.tags) {
      const targetId = tag.id ?? crypto.randomUUID();
      if (tag.id) tagIdMap.set(tag.id, targetId);
      const { error } = await supabase.from("tags").upsert({
        id: targetId,
        user_id: user.id,
        name: tag.name,
      });
      if (error) return apiError(error.message, 400);
    }

    if (payload.interactions.length) {
      const { error } = await supabase.from("interactions").upsert(
        payload.interactions.map((interaction) => ({
          id: interaction.id ?? crypto.randomUUID(),
          person_id: personIdMap.get(interaction.personId) ?? interaction.personId,
          user_id: user.id,
          type: interaction.type,
          occurred_at: interaction.occurredAt,
          note: interaction.note,
        })),
      );
      if (error) return apiError(error.message, 400);
    }

    if (payload.followUps.length) {
      const { error } = await supabase.from("follow_ups").upsert(
        payload.followUps.map((followUp) => ({
          id: followUp.id ?? crypto.randomUUID(),
          person_id: personIdMap.get(followUp.personId) ?? followUp.personId,
          user_id: user.id,
          text: followUp.text,
          due_at: followUp.dueAt,
          completed_at: followUp.completedAt,
        })),
      );
      if (error) return apiError(error.message, 400);
    }

    if (payload.personTags.length) {
      const { error } = await supabase.from("person_tags").upsert(
        payload.personTags.map((personTag) => ({
          person_id: personIdMap.get(personTag.personId) ?? personTag.personId,
          tag_id: tagIdMap.get(personTag.tagId) ?? personTag.tagId,
        })),
      );
      if (error) return apiError(error.message, 400);
    }

    return NextResponse.json({
      imported: {
        people: payload.people.length,
        interactions: payload.interactions.length,
        followUps: payload.followUps.length,
        tags: payload.tags.length,
      },
    });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
