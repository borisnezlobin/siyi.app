import type { Session } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  defaultReminderIntervals,
  type FollowUp,
  type Interaction,
  type NotificationPreference,
  type Person,
  type PersonUpdate,
  type RelationshipStrength,
  type ReminderDefaults,
  type Tag,
} from "@/lib/types";
import { supabase } from "@/lib/supabase";
import {
  followUpInputSchema,
  importPreviewSchema,
  interactionInputSchema,
  personUpdateInputSchema,
  personInputSchema,
  type FollowUpInput,
  type InteractionInput,
  type PersonUpdateInput,
  type PersonInput,
} from "@/lib/validation";
import { brand } from "@/config/brand";

type TagRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

type PersonRow = {
  id: string;
  user_id: string;
  full_name: string;
  preferred_name: string | null;
  profile_photo_url: string | null;
  instagram_username: string | null;
  phone_number: string | null;
  email: string | null;
  birthday: string | null;
  hometown: string | null;
  dorm_or_residence: string | null;
  major: string | null;
  graduation_year: number | null;
  relationship_strength: number;
  reminder_interval_days: number | null;
  status: "active" | "muted" | "archived";
  first_met_at: string;
  first_met_location: string | null;
  general_notes: string | null;
  created_at: string;
  updated_at: string;
  interactions?: { occurred_at: string }[];
  person_tags?: { tags: TagRow | TagRow[] | null }[];
};

type FollowUpRow = {
  id: string;
  person_id: string;
  user_id: string;
  text: string;
  due_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  people?:
    | {
        id: string;
        full_name: string;
        preferred_name: string | null;
        profile_photo_url: string | null;
      }
    | {
        id: string;
        full_name: string;
        preferred_name: string | null;
        profile_photo_url: string | null;
      }[]
    | null;
};

type PersonUpdateRow = {
  id: string;
  user_id: string;
  text: string;
  recorded_at: string;
  is_interaction: boolean;
  interaction_label: string | null;
  created_at: string;
  updated_at: string;
  person_update_people?: { person_id: string }[];
};

export type PersonDetails = {
  person: Person;
  interactions: Interaction[];
  followUps: FollowUp[];
  updates: PersonUpdate[];
};

export type AccountSettings = {
  timezone: string;
  reminderDefaults: ReminderDefaults;
  notificationPreference: NotificationPreference;
};

function avatarPath(value: string | null) {
  if (!value) return null;
  const match = value.match(
    /^https?:\/\/[^/]+\/storage\/v1\/object\/public\/avatars\/(.+)$/,
  );
  if (match) return decodeURIComponent(match[1]);
  return value.startsWith("http://") || value.startsWith("https://")
    ? null
    : value;
}

async function signedAvatarUrls(values: (string | null)[]) {
  const paths = Array.from(
    new Set(
      values
        .map(avatarPath)
        .filter((path): path is string => path !== null),
    ),
  );
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;

  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrls(paths, 60 * 60);
  if (error) throw error;

  for (const item of data) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

function mapTag(row: TagRow): Tag {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function mapPerson(
  row: PersonRow,
  avatarUrls: Map<string, string>,
): Person {
  const path = avatarPath(row.profile_photo_url);
  const tags = (row.person_tags || []).flatMap(({ tags: joinedTags }) => {
    if (!joinedTags) return [];
    return Array.isArray(joinedTags) ? joinedTags : [joinedTags];
  });

  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    preferredName: row.preferred_name,
    profilePhotoUrl: path ? avatarUrls.get(path) || null : row.profile_photo_url,
    profilePhotoPath: path,
    instagramUsername: row.instagram_username,
    phoneNumber: row.phone_number,
    email: row.email,
    birthday: row.birthday,
    hometown: row.hometown,
    dormOrResidence: row.dorm_or_residence,
    major: row.major,
    graduationYear: row.graduation_year,
    relationshipStrength:
      row.relationship_strength as RelationshipStrength,
    reminderIntervalDays: row.reminder_interval_days,
    status: row.status,
    firstMetAt: row.first_met_at,
    firstMetLocation: row.first_met_location,
    generalNotes: row.general_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastInteractionAt: row.interactions?.[0]?.occurred_at || null,
    tags: tags.map(mapTag),
  };
}

function relatedPerson(
  relation: FollowUpRow["people"],
) {
  return Array.isArray(relation) ? relation[0] : relation;
}

function mapFollowUp(
  row: FollowUpRow,
  avatarUrls: Map<string, string>,
): FollowUp {
  const person = relatedPerson(row.people);
  const path = avatarPath(person?.profile_photo_url || null);

  return {
    id: row.id,
    personId: row.person_id,
    userId: row.user_id,
    text: row.text,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    person: person
      ? {
          id: person.id,
          fullName: person.full_name,
          preferredName: person.preferred_name,
          profilePhotoUrl: path
            ? avatarUrls.get(path) || null
            : person.profile_photo_url,
        }
      : undefined,
  };
}

export async function getPeople() {
  const { data, error } = await supabase
    .from("people")
    .select(
      "*, interactions(occurred_at), person_tags(tags(id,user_id,name,created_at))",
    )
    .order("created_at", { ascending: false })
    .order("occurred_at", {
      referencedTable: "interactions",
      ascending: false,
    })
    .limit(1, { referencedTable: "interactions" });

  if (error) throw error;
  const rows = data as PersonRow[];
  const avatarUrls = await signedAvatarUrls(
    rows.map((row) => row.profile_photo_url),
  );
  return rows.map((row) => mapPerson(row, avatarUrls));
}

export async function getFollowUps() {
  const { data, error } = await supabase
    .from("follow_ups")
    .select("*, people(id,full_name,preferred_name,profile_photo_url)")
    .order("due_at", { ascending: true });
  if (error) throw error;

  const rows = data as FollowUpRow[];
  const avatarUrls = await signedAvatarUrls(
    rows.map(
      (row) => relatedPerson(row.people)?.profile_photo_url || null,
    ),
  );
  return rows.map((row) => mapFollowUp(row, avatarUrls));
}

export async function getPersonDetails(personId: string) {
  const [people, interactionsResult, followUpsResult] = await Promise.all([
    getPeople(),
    supabase
      .from("interactions")
      .select("*")
      .eq("person_id", personId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("follow_ups")
      .select("*, people(id,full_name,preferred_name,profile_photo_url)")
      .eq("person_id", personId)
      .order("due_at", { ascending: true }),
  ]);

  if (interactionsResult.error) throw interactionsResult.error;
  if (followUpsResult.error) throw followUpsResult.error;
  const person = people.find(({ id }) => id === personId);
  if (!person) throw new Error("This person could not be found.");

  const interactions: Interaction[] = interactionsResult.data.map((row) => ({
    id: row.id,
    personId: row.person_id,
    userId: row.user_id,
    type: row.type,
    occurredAt: row.occurred_at,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sourceUpdateId: row.source_update_id || null,
  }));
  const followUpRows = followUpsResult.data as FollowUpRow[];
  const avatarUrls = await signedAvatarUrls(
    followUpRows.map(
      (row) => relatedPerson(row.people)?.profile_photo_url || null,
    ),
  );

  const updatesResult = await supabase
    .from("person_updates")
    .select("*, person_update_people!inner(person_id)")
    .eq("person_update_people.person_id", personId)
    .order("recorded_at", { ascending: false });
  if (updatesResult.error && !isMissingUpdatesSchema(updatesResult.error.code)) {
    throw updatesResult.error;
  }
  const updates = ((updatesResult.data || []) as PersonUpdateRow[]).map(
    (row): PersonUpdate => ({
      id: row.id,
      userId: row.user_id,
      text: row.text,
      recordedAt: row.recorded_at,
      isInteraction: row.is_interaction,
      interactionLabel: row.interaction_label,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      personIds:
        row.person_update_people?.map((item) => item.person_id) || [],
    }),
  );

  return {
    person,
    interactions,
    followUps: followUpRows.map((row) => mapFollowUp(row, avatarUrls)),
    updates,
  } satisfies PersonDetails;
}

async function uploadProfilePhoto(
  userId: string,
  photo: { uri: string; fileName?: string | null; mimeType?: string | null },
) {
  const extension =
    photo.fileName?.split(".").pop()?.toLowerCase() ||
    photo.mimeType?.split("/").pop() ||
    "jpg";
  const filePath = `${userId}/${Crypto.randomUUID()}.${extension}`;
  const response = await fetch(photo.uri);
  const arrayBuffer = await response.arrayBuffer();
  const { error } = await supabase.storage
    .from("avatars")
    .upload(filePath, arrayBuffer, {
      cacheControl: "3600",
      contentType: photo.mimeType || "image/jpeg",
      upsert: false,
    });
  if (error) throw error;
  return filePath;
}

export async function createPerson(
  userId: string,
  input: PersonInput,
  photo?: { uri: string; fileName?: string | null; mimeType?: string | null },
) {
  const person = personInputSchema.parse(input);
  const profilePhotoPath = photo
    ? await uploadProfilePhoto(userId, photo)
    : null;

  const { data, error } = await supabase.rpc(
    "create_person_with_met_interaction",
    {
      person_data: {
        full_name: person.fullName,
        preferred_name: person.preferredName,
        profile_photo_url: profilePhotoPath,
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
        status: "active",
        first_met_at: new Date().toISOString(),
        first_met_location: person.firstMetLocation,
        general_notes: person.generalNotes,
      },
    },
  );

  if (error) {
    if (profilePhotoPath) {
      await supabase.storage.from("avatars").remove([profilePhotoPath]);
    }
    throw error;
  }

  return data as PersonRow;
}

export async function updatePerson(
  userId: string,
  personId: string,
  input: PersonInput,
  photo?: { uri: string; fileName?: string | null; mimeType?: string | null },
  currentPhotoPath?: string | null,
) {
  const person = personInputSchema.parse(input);
  const newPhotoPath = photo
    ? await uploadProfilePhoto(userId, photo)
    : undefined;

  const { data, error } = await supabase
    .from("people")
    .update({
      full_name: person.fullName,
      preferred_name: person.preferredName,
      profile_photo_url: newPhotoPath ?? currentPhotoPath ?? null,
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
      first_met_location: person.firstMetLocation,
      general_notes: person.generalNotes,
    })
    .eq("id", personId)
    .select()
    .single();

  if (error) {
    if (newPhotoPath) {
      await supabase.storage.from("avatars").remove([newPhotoPath]);
    }
    throw error;
  }

  if (newPhotoPath && currentPhotoPath) {
    await supabase.storage.from("avatars").remove([currentPhotoPath]);
  }
  return data as PersonRow;
}

export async function createFollowUp(userId: string, input: FollowUpInput) {
  const followUp = followUpInputSchema.parse(input);
  const { data, error } = await supabase
    .from("follow_ups")
    .insert({
      user_id: userId,
      person_id: followUp.personId,
      text: followUp.text,
      due_at: followUp.dueAt,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createInteraction(
  userId: string,
  input: InteractionInput,
) {
  const interaction = interactionInputSchema.parse(input);
  const { data, error } = await supabase
    .from("interactions")
    .insert({
      user_id: userId,
      person_id: interaction.personId,
      type: interaction.type,
      occurred_at: interaction.occurredAt,
      note: interaction.note,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

const updateTypeKinds: Record<string, Interaction["type"]> = {
  met: "met",
  talked: "other",
  texted: "texted",
  called: "called",
  coffee: "coffee",
  meal: "meal",
  party: "party",
  class: "class",
  event: "event",
  other: "other",
};

function updateKind(label: string | null) {
  return updateTypeKinds[label?.trim().toLowerCase() || ""] || "other";
}

function isMissingUpdatesSchema(code: string | undefined) {
  return ["42P01", "42883", "PGRST202", "PGRST205"].includes(code || "");
}

async function saveUpdateFallback(
  userId: string,
  update: PersonUpdateInput,
) {
  if (update.isInteraction) {
    await Promise.all(
      update.personIds.map((personId) =>
        createInteraction(userId, {
          personId,
          type: updateKind(update.interactionLabel),
          occurredAt: update.recordedAt,
          note: update.text,
        }),
      ),
    );
    return;
  }

  const { data, error } = await supabase
    .from("people")
    .select("id,general_notes")
    .in("id", update.personIds);
  if (error) throw error;
  const recordedLabel = new Date(update.recordedAt).toLocaleString();
  await Promise.all(
    data.map((person) => {
      const note = `${recordedLabel} — ${update.text}`;
      return supabase
        .from("people")
        .update({
          general_notes: person.general_notes
            ? `${person.general_notes}\n\n${note}`
            : note,
        })
        .eq("id", person.id)
        .then(({ error: updateError }) => {
          if (updateError) throw updateError;
        });
    }),
  );
}

export async function createPersonUpdate(
  userId: string,
  input: PersonUpdateInput,
) {
  const update = personUpdateInputSchema.parse(input);
  const { data, error } = await supabase.rpc("create_person_update", {
    person_ids: update.personIds,
    update_text: update.text,
    recorded_at: update.recordedAt,
    is_interaction: update.isInteraction,
    interaction_label: update.isInteraction
      ? update.interactionLabel || "Talked"
      : null,
    interaction_kind: updateKind(update.interactionLabel),
  });

  if (!error) return data;
  if (!isMissingUpdatesSchema(error.code)) throw error;
  await saveUpdateFallback(userId, update);
  return null;
}

export async function getRecentUpdateTypes() {
  const { data, error } = await supabase
    .from("person_updates")
    .select("interaction_label")
    .eq("is_interaction", true)
    .not("interaction_label", "is", null)
    .order("recorded_at", { ascending: false })
    .limit(30);
  if (error && isMissingUpdatesSchema(error.code)) return [];
  if (error) throw error;
  return Array.from(
    new Set(
      data
        .map((item) => item.interaction_label?.trim())
        .filter((label): label is string => Boolean(label)),
    ),
  );
}

export async function setFollowUpComplete(
  followUpId: string,
  complete: boolean,
) {
  const { error } = await supabase
    .from("follow_ups")
    .update({ completed_at: complete ? new Date().toISOString() : null })
    .eq("id", followUpId);
  if (error) throw error;
}

export async function archivePerson(personId: string) {
  const { error } = await supabase
    .from("people")
    .update({ status: "archived" })
    .eq("id", personId);
  if (error) throw error;
}

export async function completeOnboarding(input: {
  userId: string;
  displayName: string;
  timezone: string;
  locale: string;
}) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("user_profiles")
    .update({
      display_name: input.displayName.trim(),
      timezone: input.timezone,
      locale: input.locale,
      onboarding_completed_at: now,
    })
    .eq("auth_user_id", input.userId);
  if (error) throw error;
}

export async function getAccountSettings(userId: string) {
  const [profileResult, settingsResult, preferencesResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("timezone")
      .eq("auth_user_id", userId)
      .single(),
    supabase.from("user_settings").select("*").eq("user_id", userId).single(),
    supabase
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .single(),
  ]);

  const error =
    profileResult.error || settingsResult.error || preferencesResult.error;
  if (error) throw error;

  return {
    timezone: profileResult.data.timezone,
    reminderDefaults: {
      1: settingsResult.data.strength_1_days,
      2: settingsResult.data.strength_2_days,
      3: settingsResult.data.strength_3_days,
      4: settingsResult.data.strength_4_days,
    },
    notificationPreference: {
      id: preferencesResult.data.id,
      userId: preferencesResult.data.user_id,
      pushEnabled: preferencesResult.data.push_enabled,
      overdueContactEnabled:
        preferencesResult.data.overdue_contact_enabled,
      birthdayEnabled: preferencesResult.data.birthday_enabled,
      followUpEnabled: preferencesResult.data.follow_up_enabled,
      reminderHourLocal: preferencesResult.data.reminder_hour_local,
      reminderDaysOfWeek: preferencesResult.data.reminder_days_of_week,
      createdAt: preferencesResult.data.created_at,
      updatedAt: preferencesResult.data.updated_at,
    },
  } satisfies AccountSettings;
}

export async function saveAccountSettings(
  userId: string,
  timezone: string,
  intervals: ReminderDefaults = defaultReminderIntervals,
) {
  const [profileResult, settingsResult] = await Promise.all([
    supabase
      .from("user_profiles")
      .update({ timezone })
      .eq("auth_user_id", userId),
    supabase
      .from("user_settings")
      .update({
        strength_1_days: intervals[1],
        strength_2_days: intervals[2],
        strength_3_days: intervals[3],
        strength_4_days: intervals[4],
      })
      .eq("user_id", userId),
  ]);
  const error = profileResult.error || settingsResult.error;
  if (error) throw error;
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: Omit<
    NotificationPreference,
    "id" | "userId" | "createdAt" | "updatedAt"
  >,
) {
  const { error } = await supabase
    .from("notification_preferences")
    .update({
      push_enabled: preferences.pushEnabled,
      overdue_contact_enabled: preferences.overdueContactEnabled,
      birthday_enabled: preferences.birthdayEnabled,
      follow_up_enabled: preferences.followUpEnabled,
      reminder_hour_local: preferences.reminderHourLocal,
      reminder_days_of_week: preferences.reminderDaysOfWeek,
    })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function deleteAccount(session: Session, webUrl: string) {
  if (!webUrl) {
    throw new Error("Set the production web URL before deleting accounts.");
  }

  const response = await fetch(`${webUrl}/api/account`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || "The account could not be deleted.");
  }
  await supabase.auth.signOut({ scope: "local" });
}

function requireWebUrl(webUrl: string) {
  if (!webUrl) {
    throw new Error("Set the production web URL before using this feature.");
  }
  return webUrl.replace(/\/$/, "");
}

async function authenticatedWebRequest(
  session: Session,
  webUrl: string,
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`${requireWebUrl(webUrl)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? ((await response.json().catch(() => null)) as
          | { error?: string }
          | null)
      : null;
    throw new Error(
      payload?.error ||
        `The server returned ${response.status}. Please try again.`,
    );
  }
  return response;
}

export type ExportFormat =
  | "json"
  | "people-csv"
  | "interactions-csv"
  | "updates-csv";

export async function shareAccountExport(
  session: Session,
  webUrl: string,
  format: ExportFormat,
) {
  const response = await authenticatedWebRequest(
    session,
    webUrl,
    `/api/export?format=${encodeURIComponent(format)}`,
  );
  const content = await response.text();
  const extension = format === "json" ? "json" : "csv";
  const suffix =
    format === "people-csv"
      ? "contacts"
      : format === "updates-csv"
        ? "updates"
      : format === "interactions-csv"
        ? "interactions"
        : "export";
  const file = new File(
    Paths.cache,
    `${brand.slug}-${suffix}-${new Date().toISOString().slice(0, 10)}.${extension}`,
  );
  file.create({ overwrite: true, intermediates: true });
  file.write(content);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: extension === "json" ? "application/json" : "text/csv",
    dialogTitle: `Export from ${brand.name}`,
  });
}

export async function chooseImportFile() {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/json", "text/plain"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;

  const response = await fetch(result.assets[0].uri);
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }

  const preview = importPreviewSchema.safeParse(payload);
  if (!preview.success) {
    const issue = preview.error.issues[0];
    throw new Error(
      `Invalid ${issue.path.join(".") || "file"}: ${issue.message}`,
    );
  }

  return {
    payload,
    preview: {
      people: preview.data.people.length,
      updates: preview.data.updates.length,
      interactions: preview.data.interactions.length,
      followUps: preview.data.followUps.length,
      tags: preview.data.tags.length,
    },
  };
}

export async function importAccountData(
  session: Session,
  webUrl: string,
  payload: unknown,
) {
  const response = await authenticatedWebRequest(
    session,
    webUrl,
    "/api/import",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  return (await response.json()) as {
    imported: {
      people: number;
      updates: number;
      interactions: number;
      followUps: number;
      tags: number;
    };
  };
}
