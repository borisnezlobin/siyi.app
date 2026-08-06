import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { isOwnedAvatarReference } from "@/lib/avatar-urls";
import { requireAuthenticatedUser } from "@/lib/auth";
import { saveContactMethods } from "@/app/api/people/contact-methods";
import {
  legacyColumnsFromDrafts,
  normalizeContactDrafts,
} from "@/lib/contact-methods";
import { writeTolerantOfPendingColumns } from "@/lib/pending-columns";
import { createClient } from "@/lib/supabase/server";
import { personInputSchema } from "@/lib/validation";

const updatePersonSchema = personInputSchema.partial().extend({
  status: z.enum(["active", "muted", "archived"]).optional(),
});

function toDatabaseUpdate(data: z.infer<typeof updatePersonSchema>) {
  return {
    ...(data.fullName !== undefined && { full_name: data.fullName }),
    ...(data.preferredName !== undefined && { preferred_name: data.preferredName }),
    ...(data.profilePhotoUrl !== undefined && {
      profile_photo_url: data.profilePhotoUrl,
    }),
    ...(data.instagramUsername !== undefined && {
      instagram_username: data.instagramUsername,
    }),
    ...(data.phoneNumber !== undefined && { phone_number: data.phoneNumber }),
    ...(data.email !== undefined && { email: data.email }),
    ...(data.birthday !== undefined && { birthday: data.birthday }),
    ...(data.hometown !== undefined && { hometown: data.hometown }),
    ...(data.dormOrResidence !== undefined && {
      dorm_or_residence: data.dormOrResidence,
    }),
    ...(data.major !== undefined && { major: data.major }),
    ...(data.graduationYear !== undefined && {
      graduation_year: data.graduationYear,
    }),
    ...(data.relationshipStrength !== undefined && {
      relationship_strength: data.relationshipStrength,
    }),
    ...(data.relationshipLabel !== undefined && {
      relationship_label: data.relationshipLabel,
    }),
    ...(data.remindersEnabled !== undefined && {
      reminders_enabled: data.remindersEnabled,
    }),
    ...(data.reminderIntervalDays !== undefined && {
      reminder_interval_days: data.reminderIntervalDays,
    }),
    ...(data.status !== undefined && { status: data.status }),
    ...(data.firstMetAt !== undefined && { first_met_at: data.firstMetAt }),
    ...(data.firstMetLocation !== undefined && {
      first_met_location: data.firstMetLocation,
    }),
    ...(data.generalNotes !== undefined && { general_notes: data.generalNotes }),
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuthenticatedUser();
    const { id } = await params;
    const validation = updatePersonSchema.safeParse(await request.json());
    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid update.");
    }
    if (
      !isOwnedAvatarReference(validation.data.profilePhotoUrl, user.id)
    ) {
      return apiError("The profile photo does not belong to this account.");
    }

    const supabase = await createClient();
    // The three single columns stay the primary of each kind, because every
    // other reader — export, contact sync, search, the phone app — still reads
    // them. Dropping them is a separate job for later.
    const drafts = validation.data.contactMethods
      ? normalizeContactDrafts(validation.data.contactMethods)
      : null;
    const primaries = drafts ? legacyColumnsFromDrafts(drafts) : null;
    const personUpdate = {
      ...toDatabaseUpdate(validation.data),
      ...(primaries
        ? {
            phone_number: primaries.phoneNumber,
            email: primaries.email,
            instagram_username: primaries.instagramUsername,
          }
        : {}),
    };

    const { data, error } = await writeTolerantOfPendingColumns(
      personUpdate,
      (row) =>
        supabase
          .from("people")
          .update(row)
          .eq("id", id)
          .eq("user_id", user.id)
          .select()
          .single(),
    );

    if (error) return apiError(error.message, 400);

    if (drafts) {
      const saved = await saveContactMethods(supabase, user.id, id, drafts);
      if (saved.error) return apiError(saved.error, 400);
    }

    return NextResponse.json({ person: data });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
