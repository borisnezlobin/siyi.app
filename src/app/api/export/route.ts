import { NextResponse, type NextRequest } from "next/server";
import { brand } from "@/config/brand";
import { apiError, errorMessage } from "@/lib/api";
import { requireAuthenticatedRequest } from "@/lib/api-auth";

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
    const { user, supabase } = await requireAuthenticatedRequest(request);
    const format = new URL(request.url).searchParams.get("format") ?? "json";
    const [
      profileResult,
      settingsResult,
      preferencesResult,
      peopleResult,
      interactionsResult,
      tagsResult,
      personTagsResult,
      remindersResult,
      deliveriesResult,
      subscriptionsResult,
      nativeSubscriptionsResult,
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
      supabase.from("reminders").select("*").eq("user_id", user.id),
      supabase
        .from("notification_deliveries")
        .select("*")
        .eq("user_id", user.id),
      supabase
        .from("push_subscriptions")
        .select("id,endpoint,user_agent,created_at,updated_at,last_used_at,revoked_at")
        .eq("user_id", user.id),
      supabase
        .from("native_push_subscriptions")
        .select(
          "id,platform,device_name,app_version,created_at,updated_at,last_used_at,revoked_at",
        )
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
      remindersResult.error,
      deliveriesResult.error,
      subscriptionsResult.error,
      nativeSubscriptionsResult.error,
    ].find(Boolean);

    if (firstError) return apiError(firstError.message, 500);

    const [updatesResult, updatePeopleResult] = await Promise.all([
      supabase.from("person_updates").select("*").eq("user_id", user.id),
      supabase.from("person_update_people").select("*").eq("user_id", user.id),
    ]);
    const updatesError = [updatesResult.error, updatePeopleResult.error].find(Boolean);
    if (updatesError) return apiError(updatesError.message, 500);
    const updates = updatesResult.data ?? [];
    const updatePeople = updatePeopleResult.data ?? [];

    const contactMethodsResult = await supabase
      .from("person_contact_methods")
      .select("*")
      .eq("user_id", user.id);
    if (contactMethodsResult.error) {
      return apiError(contactMethodsResult.error.message, 500);
    }
    const contactMethods = contactMethodsResult.error
      ? []
      : contactMethodsResult.data ?? [];
    const contactValuesByPerson = new Map<string, Record<string, string[]>>();
    for (const method of contactMethods) {
      const forPerson = contactValuesByPerson.get(method.person_id) ?? {};
      const values = forPerson[method.kind] ?? [];
      // Primary first, so a spreadsheet's first value is the main one.
      if (method.is_primary) values.unshift(method.value);
      else values.push(method.value);
      forPerson[method.kind] = values;
      contactValuesByPerson.set(method.person_id, forPerson);
    }
    const allValuesOf = (
      person: { id: string },
      kind: string,
      fallback: string | null,
    ) => {
      const values = contactValuesByPerson.get(person.id)?.[kind];
      if (values?.length) return values.join("; ");
      return fallback ?? "";
    };

    if (format === "people-csv") {
      const headers = [
        "Full name",
        "Preferred name",
        "Instagram",
        "Phone",
        "Email",
        "All Instagram",
        "All phones",
        "All emails",
        "Birthday",
        "Hometown",
        "Residence",
        "University",
        "Major",
        "Graduation year",
        "Relationship strength",
        "Relationship label",
        "Reminders enabled",
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
          allValuesOf(person, "instagram", person.instagram_username),
          allValuesOf(person, "phone", person.phone_number),
          allValuesOf(person, "email", person.email),
          person.birthday,
          person.hometown,
          person.dorm_or_residence,
          person.university,
          person.major,
          person.graduation_year,
          person.relationship_strength,
          person.relationship_label,
          person.reminders_enabled,
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

    if (format === "updates-csv") {
      const namesById = new Map(
        (peopleResult.data ?? []).map((person) => [person.id, person.full_name]),
      );
      const peopleByUpdateId = new Map<string, string[]>();
      for (const link of updatePeople) {
        const names = peopleByUpdateId.get(link.update_id) ?? [];
        names.push(namesById.get(link.person_id) ?? "Unknown person");
        peopleByUpdateId.set(link.update_id, names);
      }
      const headers = [
        "People",
        "Update",
        "Recorded at",
        "Interaction",
        "Interaction type",
      ];
      const exportRows = [
        ...updates.map((update) => ({
          people: (peopleByUpdateId.get(update.id) ?? []).join("; "),
          text: update.text,
          recordedAt: update.recorded_at,
          isInteraction: update.is_interaction,
          interactionLabel: update.interaction_label,
        })),
        ...(interactionsResult.data ?? [])
          .filter((interaction) => !interaction.source_update_id)
          .map((interaction) => ({
            people: namesById.get(interaction.person_id) ?? "Unknown person",
            text: interaction.note || interaction.type,
            recordedAt: interaction.occurred_at,
            isInteraction: true,
            interactionLabel: interaction.type,
          })),
      ].sort(
        (left, right) =>
          new Date(right.recordedAt).getTime() -
          new Date(left.recordedAt).getTime(),
      );
      const rows = exportRows.map((update) =>
        [
          update.people,
          update.text,
          update.recordedAt,
          update.isInteraction ? "Yes" : "No",
          update.interactionLabel,
        ]
          .map(csvCell)
          .join(","),
      );
      return downloadResponse(
        [headers.map(csvCell).join(","), ...rows].join("\n"),
        "text/csv; charset=utf-8",
        `${brand.slug}-updates.csv`,
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
        university: person.university ?? null,
        major: person.major,
        graduationYear: person.graduation_year,
        relationshipStrength: person.relationship_strength,
        relationshipLabel: person.relationship_label ?? null,
        remindersEnabled: person.reminders_enabled ?? true,
        reminderIntervalDays: person.reminder_interval_days,
        status: person.status,
        firstMetAt: person.first_met_at,
        firstMetLocation: person.first_met_location,
        generalNotes: person.general_notes,
        createdAt: person.created_at,
        updatedAt: person.updated_at,
      })),
      contactMethods: contactMethods.map((method) => ({
        id: method.id,
        personId: method.person_id,
        kind: method.kind,
        value: method.value,
        label: method.label,
        position: method.position,
        isPrimary: method.is_primary,
        createdAt: method.created_at,
        updatedAt: method.updated_at,
      })),
      interactions: (interactionsResult.data ?? []).map((interaction) => ({
        id: interaction.id,
        personId: interaction.person_id,
        type: interaction.type,
        occurredAt: interaction.occurred_at,
        note: interaction.note,
        sourceUpdateId: interaction.source_update_id,
        createdAt: interaction.created_at,
        updatedAt: interaction.updated_at,
      })),
      updates: updates.map((update) => ({
        id: update.id,
        text: update.text,
        recordedAt: update.recorded_at,
        isInteraction: update.is_interaction,
        interactionLabel: update.interaction_label,
        createdAt: update.created_at,
        updatedAt: update.updated_at,
      })),
      updatePeople: updatePeople.map((link) => ({
        updateId: link.update_id,
        personId: link.person_id,
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
      reminders: (remindersResult.data ?? []).map((reminder) => ({
        id: reminder.id,
        personId: reminder.person_id,
        text: reminder.text,
        dueAt: reminder.due_at,
        completedAt: reminder.completed_at,
        createdAt: reminder.created_at,
        updatedAt: reminder.updated_at,
      })),
      notificationDeliveries: deliveriesResult.data ?? [],
      pushSubscriptions: subscriptionsResult.data ?? [],
      nativePushSubscriptions: nativeSubscriptionsResult.data ?? [],
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
