import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { isOwnedAvatarReference } from "@/lib/avatar-urls";
import { requireAuthenticatedUser } from "@/lib/auth";
import { saveContactMethods } from "@/app/api/people/contact-methods";
import {
  legacyColumnsFromDrafts,
  normalizeContactDrafts,
} from "@/lib/contact-methods";
import { personSlug } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { personInputSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const validation = personInputSchema.safeParse(await request.json());

    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid person data.");
    }

    const person = validation.data;
    if (!isOwnedAvatarReference(person.profilePhotoUrl, user.id)) {
      return apiError("The profile photo does not belong to this account.");
    }

    // The single columns keep holding the primary of each kind, so everything
    // that has always read them carries on unchanged.
    const drafts = person.contactMethods
      ? normalizeContactDrafts(person.contactMethods)
      : null;
    const primaries = drafts
      ? legacyColumnsFromDrafts(drafts)
      : {
          phoneNumber: person.phoneNumber,
          email: person.email,
          instagramUsername: person.instagramUsername,
        };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "create_person_with_met_interaction",
      {
        person_data: {
          full_name: person.fullName,
          preferred_name: person.preferredName,
          profile_photo_url: person.profilePhotoUrl,
          instagram_username: primaries.instagramUsername,
          phone_number: primaries.phoneNumber,
          email: primaries.email,
          birthday: person.birthday,
          hometown: person.hometown,
          dorm_or_residence: person.dormOrResidence,
          // Ignored by the database until migration 0014 has run.
          university: person.university,
          major: person.major,
          graduation_year: person.graduationYear,
          relationship_strength: person.relationshipStrength,
          relationship_label: person.relationshipLabel,
          reminders_enabled: person.remindersEnabled,
          reminder_interval_days: person.reminderIntervalDays,
          status: person.status,
          first_met_at: person.firstMetAt ?? new Date().toISOString(),
          first_met_location: person.firstMetLocation,
          general_notes: person.generalNotes,
          // Ignored by the database until migration 0012 has run, and replaced
          // there if this account already holds the same slug.
          slug: personSlug(person.fullName),
        },
      },
    );

    if (error) return apiError(error.message, 500);

    const createdId = (data as { id?: string } | null)?.id;
    if (drafts && drafts.length > 0 && createdId) {
      // The person is already saved; a contact row that fails to write should
      // not take the whole save down with it.
      await saveContactMethods(supabase, user.id, createdId, drafts);
    }

    return NextResponse.json({ person: data }, { status: 201 });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
