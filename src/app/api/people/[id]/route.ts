import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
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

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("people")
      .update(toDatabaseUpdate(validation.data))
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return apiError(error.message, 400);
    return NextResponse.json({ person: data });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
