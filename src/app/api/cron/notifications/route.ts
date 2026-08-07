import { NextResponse, type NextRequest } from "next/server";
import { apiError, errorMessage } from "@/lib/api";
import {
  evaluateUserNotifications,
  isNotificationEvaluationTime,
} from "@/lib/notification-evaluator";
import { sendPushToUser } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RelationshipStrength, ReminderDefaults } from "@/lib/types";

type ProfileRow = {
  auth_user_id: string;
  timezone: string;
};

type PreferenceRow = {
  user_id: string;
  push_enabled: boolean;
  overdue_contact_enabled: boolean;
  birthday_enabled: boolean;
  follow_up_enabled: boolean;
  reminder_hour_local: number;
  reminder_days_of_week: number[];
};

type SettingsRow = {
  user_id: string;
  strength_1_days: number;
  strength_2_days: number;
  strength_3_days: number;
  strength_4_days: number;
};

type PersonRow = {
  id: string;
  user_id: string;
  full_name: string;
  preferred_name: string | null;
  birthday: string | null;
  relationship_strength: number;
  reminders_enabled: boolean | null;
  reminder_interval_days: number | null;
  first_met_at: string;
};

type InteractionRow = {
  person_id: string;
  occurred_at: string;
};

type ReminderRow = {
  id: string;
  user_id: string;
  person_id: string;
  text: string;
  due_at: string;
};

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return apiError("Scheduled notifications are not configured.", 503);
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return apiError("Unauthorized.", 401);
  }

  try {
    const admin = createAdminClient();
    const now = new Date();
    const [profilesResult, preferencesResult, settingsResult] =
      await Promise.all([
      admin.from("user_profiles").select("auth_user_id,timezone"),
      admin.from("notification_preferences").select("*").eq("push_enabled", true),
      admin.from("user_settings").select("*"),
    ]);

    const initialError = [
      profilesResult.error,
      preferencesResult.error,
      settingsResult.error,
    ].find(Boolean);
    if (initialError) {
      return apiError(initialError.message, 500);
    }

    const profiles = profilesResult.data as ProfileRow[];
    const preferences = preferencesResult.data as PreferenceRow[];
    const settings = settingsResult.data as SettingsRow[];
    const profilesByUser = new Map(
      profiles.map((profile) => [profile.auth_user_id, profile]),
    );
    const eligiblePreferences = preferences.filter((preference) => {
      const profile = profilesByUser.get(preference.user_id);
      if (!profile) return false;
      try {
        return isNotificationEvaluationTime(
          profile.timezone,
          {
            pushEnabled: preference.push_enabled,
            reminderHourLocal: preference.reminder_hour_local,
            reminderDaysOfWeek: preference.reminder_days_of_week,
          },
          now,
        );
      } catch {
        return false;
      }
    });

    if (eligiblePreferences.length === 0) {
      return NextResponse.json({
        evaluatedAt: now.toISOString(),
        delivered: 0,
        skipped: 0,
        failed: 0,
      });
    }

    const eligibleUserIds = eligiblePreferences.map(
      (preference) => preference.user_id,
    );
    // Reminders are opt-out, so a database still waiting on migration 0008 has
    // no opt-out column and every person is simply included.
    const selectPeople = (columns: string) =>
      admin
        .from("people")
        .select(columns)
        .eq("status", "active")
        .in("user_id", eligibleUserIds);
    const peopleColumns =
      "id,user_id,full_name,preferred_name,birthday,relationship_strength,reminder_interval_days,first_met_at";

    const [peopleResult, interactionsResult, remindersResult] =
      await Promise.all([
      selectPeople(`${peopleColumns},reminders_enabled`).then((result) =>
        result.error && ["42703", "PGRST204"].includes(result.error.code ?? "")
          ? selectPeople(peopleColumns)
          : result,
      ),
      admin
        .from("interactions")
        .select("person_id,occurred_at")
        .in("user_id", eligibleUserIds)
        .order("occurred_at", { ascending: false }),
      admin
        .from("reminders")
        .select("id,user_id,person_id,text,due_at")
        .in("user_id", eligibleUserIds)
        .is("completed_at", null),
    ]);

    const firstError = [
      peopleResult.error,
      interactionsResult.error,
      remindersResult.error,
    ].find(Boolean);

    if (firstError) {
      return apiError(firstError.message, 500);
    }

    const people = peopleResult.data as unknown as PersonRow[];
    const interactions = interactionsResult.data as InteractionRow[];
    const reminders = remindersResult.data as ReminderRow[];

    const latestInteractionByPerson = new Map<string, string>();
    for (const interaction of interactions) {
      if (!latestInteractionByPerson.has(interaction.person_id)) {
        latestInteractionByPerson.set(
          interaction.person_id,
          interaction.occurred_at,
        );
      }
    }

    const settingsByUser = new Map(
      settings.map((userSettings) => [userSettings.user_id, userSettings]),
    );
    let delivered = 0;
    let skipped = 0;
    let failed = 0;

    for (const preference of eligiblePreferences) {
      const profile = profilesByUser.get(preference.user_id);
      if (!profile) continue;

      const userSettings = settingsByUser.get(preference.user_id);
      const reminderDefaults: ReminderDefaults | undefined = userSettings
        ? {
            1: userSettings.strength_1_days,
            2: userSettings.strength_2_days,
            3: userSettings.strength_3_days,
            4: userSettings.strength_4_days,
          }
        : undefined;
      const userPeople = people.filter(
        (person) => person.user_id === preference.user_id,
      );
      const peopleById = new Map(userPeople.map((person) => [person.id, person]));
      const candidates = evaluateUserNotifications(
        {
          userId: preference.user_id,
          timezone: profile.timezone,
          preferences: {
            pushEnabled: preference.push_enabled,
            overdueContactEnabled: preference.overdue_contact_enabled,
            birthdayEnabled: preference.birthday_enabled,
            reminderEnabled: preference.follow_up_enabled,
            reminderHourLocal: preference.reminder_hour_local,
            reminderDaysOfWeek: preference.reminder_days_of_week,
          },
          reminderDefaults,
          people: userPeople.map((person) => ({
            id: person.id,
            fullName: person.full_name,
            preferredName: person.preferred_name,
            birthday: person.birthday,
            relationshipStrength:
              person.relationship_strength as RelationshipStrength,
            reminderIntervalDays: person.reminder_interval_days,
            remindersEnabled: person.reminders_enabled ?? true,
            firstMetAt: person.first_met_at,
            lastInteractionAt:
              latestInteractionByPerson.get(person.id) ?? null,
          })),
          reminders: reminders
            .filter((reminder) => reminder.user_id === preference.user_id)
            .map((reminder) => {
              const person = peopleById.get(reminder.person_id);
              return {
                id: reminder.id,
                personId: reminder.person_id,
                text: reminder.text,
                dueAt: reminder.due_at,
                personName:
                  person?.preferred_name ?? person?.full_name ?? "someone",
              };
            }),
        },
        now,
      );

      for (const candidate of candidates) {
        const { data: delivery, error: deliveryError } = await admin
          .from("notification_deliveries")
          .insert({
            user_id: preference.user_id,
            type: candidate.type,
            related_entity_id: candidate.relatedEntityId,
            scheduled_for: candidate.scheduledFor,
            status: "pending",
            deduplication_key: candidate.deduplicationKey,
          })
          .select("id")
          .single();

        if (deliveryError?.code === "23505") {
          skipped += 1;
          continue;
        }
        if (deliveryError || !delivery) {
          failed += 1;
          continue;
        }

        const sendResult = await sendPushToUser(admin, preference.user_id, {
          title: candidate.title,
          body: candidate.body,
          url: candidate.url,
          tag: candidate.tag,
        });
        const status =
          sendResult.delivered > 0
            ? "delivered"
            : sendResult.failed > 0 || sendResult.revoked > 0
              ? "failed"
              : "skipped";
        const failureReason =
          status === "failed"
            ? sendResult.revoked > 0
              ? "Subscription endpoint is no longer valid."
              : "Push provider rejected the delivery."
            : status === "skipped"
              ? "No active push subscription."
              : null;

        await admin
          .from("notification_deliveries")
          .update({
            status,
            delivered_at:
              status === "delivered" ? new Date().toISOString() : null,
            failure_reason: failureReason,
          })
          .eq("id", delivery.id);

        if (status === "delivered") delivered += 1;
        else if (status === "failed") failed += 1;
        else skipped += 1;
      }
    }

    return NextResponse.json({ evaluatedAt: now.toISOString(), delivered, skipped, failed });
  } catch (error) {
    return apiError(errorMessage(error), 500);
  }
}
