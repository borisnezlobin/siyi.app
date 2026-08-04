import { NextResponse, type NextRequest } from "next/server";
import { brand } from "@/config/brand";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function downloadResponse(
  content: string,
  contentType: string,
  fileName: string,
) {
  return new NextResponse(content, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuthenticatedUser();
    const supabase = await createClient();
    const format = new URL(request.url).searchParams.get("format") ?? "json";
    const [
      profileResult,
      settingsResult,
      preferencesResult,
      peopleResult,
      interactionsResult,
      tagsResult,
      personTagsResult,
      followUpsResult,
      deliveriesResult,
      subscriptionsResult,
    ] = await Promise.all([
      supabase.from("user_profiles").select("*").eq("auth_user_id", user.id).maybeSingle(),
      supabase.from("user_settings").select("*").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("people").select("*").eq("user_id", user.id),
      supabase.from("interactions").select("*").eq("user_id", user.id),
      supabase.from("tags").select("*").eq("user_id", user.id),
      supabase.from("person_tags").select("*"),
      supabase.from("follow_ups").select("*").eq("user_id", user.id),
      supabase
        .from("notification_deliveries")
        .select("*")
        .eq("user_id", user.id),
      supabase
        .from("push_subscriptions")
        .select("id,endpoint,user_agent,created_at,updated_at,last_used_at,revoked_at")
        .eq("user_id", user.id),
    ]);

    const firstError = [
      profileResult.error,
      settingsResult.error,
      preferencesResult.error,
      peopleResult.error,
      interactionsResult.error,
      tagsResult.error,
      personTagsResult.error,
      followUpsResult.error,
      deliveriesResult.error,
      subscriptionsResult.error,
    ].find(Boolean);

    if (firstError) return apiError(firstError.message, 500);

    if (format === "people-csv") {
      const headers = [
        "Full name",
        "Preferred name",
        "Instagram",
        "Phone",
        "Email",
        "Birthday",
        "Hometown",
        "Residence",
        "Major",
        "Graduation year",
        "Relationship strength",
        "Reminder interval days",
        "Status",
        "First met at",
        "First met location",
        "Notes",
      ];
      const rows = (peopleResult.data ?? []).map((person) =>
        [
          person.full_name,
          person.preferred_name,
          person.instagram_username,
          person.phone_number,
          person.email,
          person.birthday,
          person.hometown,
          person.dorm_or_residence,
          person.major,
          person.graduation_year,
          person.relationship_strength,
          person.reminder_interval_days,
          person.status,
          person.first_met_at,
          person.first_met_location,
          person.general_notes,
        ]
          .map(csvCell)
          .join(","),
      );
      return downloadResponse(
        [headers.map(csvCell).join(","), ...rows].join("\n"),
        "text/csv; charset=utf-8",
        `${brand.slug}-contacts.csv`,
      );
    }

    if (format === "interactions-csv") {
      const namesById = new Map(
        (peopleResult.data ?? []).map((person) => [person.id, person.full_name]),
      );
      const headers = ["Person", "Type", "Occurred at", "Note"];
      const rows = (interactionsResult.data ?? []).map((interaction) =>
        [
          namesById.get(interaction.person_id),
          interaction.type,
          interaction.occurred_at,
          interaction.note,
        ]
          .map(csvCell)
          .join(","),
      );
      return downloadResponse(
        [headers.map(csvCell).join(","), ...rows].join("\n"),
        "text/csv; charset=utf-8",
        `${brand.slug}-interactions.csv`,
      );
    }

    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: profileResult.data,
      settings: settingsResult.data,
      notificationPreferences: preferencesResult.data,
      people: (peopleResult.data ?? []).map((person) => ({
        id: person.id,
        fullName: person.full_name,
        preferredName: person.preferred_name,
        profilePhotoUrl: person.profile_photo_url,
        instagramUsername: person.instagram_username,
        phoneNumber: person.phone_number,
        email: person.email,
        birthday: person.birthday,
        hometown: person.hometown,
        dormOrResidence: person.dorm_or_residence,
        major: person.major,
        graduationYear: person.graduation_year,
        relationshipStrength: person.relationship_strength,
        reminderIntervalDays: person.reminder_interval_days,
        status: person.status,
        firstMetAt: person.first_met_at,
        firstMetLocation: person.first_met_location,
        generalNotes: person.general_notes,
        createdAt: person.created_at,
        updatedAt: person.updated_at,
      })),
      interactions: (interactionsResult.data ?? []).map((interaction) => ({
        id: interaction.id,
        personId: interaction.person_id,
        type: interaction.type,
        occurredAt: interaction.occurred_at,
        note: interaction.note,
        createdAt: interaction.created_at,
        updatedAt: interaction.updated_at,
      })),
      tags: (tagsResult.data ?? []).map((tag) => ({
        id: tag.id,
        name: tag.name,
        createdAt: tag.created_at,
      })),
      personTags: (personTagsResult.data ?? []).map((personTag) => ({
        personId: personTag.person_id,
        tagId: personTag.tag_id,
      })),
      followUps: (followUpsResult.data ?? []).map((followUp) => ({
        id: followUp.id,
        personId: followUp.person_id,
        text: followUp.text,
        dueAt: followUp.due_at,
        completedAt: followUp.completed_at,
        createdAt: followUp.created_at,
        updatedAt: followUp.updated_at,
      })),
      notificationDeliveries: deliveriesResult.data ?? [],
      pushSubscriptions: subscriptionsResult.data ?? [],
    };

    return downloadResponse(
      JSON.stringify(payload, null, 2),
      "application/json; charset=utf-8",
      `${brand.slug}-export.json`,
    );
  } catch (error) {
    return apiError(errorMessage(error), 401);
  }
}
