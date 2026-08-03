import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { personInputSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    await requireAuthenticatedUser();
    const validation = personInputSchema.safeParse(await request.json());

    if (!validation.success) {
      return apiError(validation.error.issues[0]?.message ?? "Invalid person data.");
    }

    const person = validation.data;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "create_person_with_met_interaction",
      {
        person_data: {
          full_name: person.fullName,
          preferred_name: person.preferredName,
          profile_photo_url: person.profilePhotoUrl,
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
        },
      },
    );

    if (error) return apiError(error.message, 500);
    return NextResponse.json({ person: data }, { status: 201 });
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
