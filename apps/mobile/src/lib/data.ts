import type { Session } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
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
import { looksLikeUuid } from "@/lib/person-links";
import { supabase } from "@/lib/supabase";
import {
  clearOfflineUserData,
  enqueueOfflineMutation,
  getOfflineQueue,
  getOfflineSnapshot,
  isOnline,
  persistPhotoForQueue,
  removeOfflineMutation,
  removeQueuedPhoto,
  updateOfflineSnapshot,
  type OfflineMutation,
} from "@/lib/offline-store";
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
  slug?: string | null;
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
  relationship_label: string | null;
  reminders_enabled: boolean | null;
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

const avatarCacheDirectory = new Directory(
  Paths.document,
  "siyi-avatar-cache",
);

async function currentUserId() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

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

async function cachedAvatarUrl(
  remoteUrl: string | null,
  storagePath: string | null,
) {
  if (!remoteUrl || !storagePath || remoteUrl.startsWith("file:")) {
    return remoteUrl;
  }
  if (!avatarCacheDirectory.exists) {
    avatarCacheDirectory.create({ idempotent: true, intermediates: true });
  }
  const fileName = storagePath.replace(/[^A-Za-z0-9._-]/g, "_");
  const destination = new File(avatarCacheDirectory, fileName);
  if (destination.exists) return destination.uri;

  try {
    await File.downloadFileAsync(remoteUrl, destination, {
      idempotent: true,
    });
    return destination.uri;
  } catch {
    return remoteUrl;
  }
}

async function cachePeopleAvatars(people: Person[]) {
  return Promise.all(
    people.map(async (person) => ({
      ...person,
      profilePhotoUrl: await cachedAvatarUrl(
        person.profilePhotoUrl,
        person.profilePhotoPath,
      ),
    })),
  );
}

async function cacheFollowUpAvatars(followUps: FollowUp[]) {
  return Promise.all(
    followUps.map(async (followUp) => {
      if (!followUp.person) return followUp;
      return {
        ...followUp,
        person: {
          ...followUp.person,
          profilePhotoUrl: await cachedAvatarUrl(
            followUp.person.profilePhotoUrl,
            followUp.person.profilePhotoPath,
          ),
        },
      };
    }),
  );
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
    slug: row.slug ?? null,
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
    relationshipLabel: row.relationship_label ?? null,
    remindersEnabled: row.reminders_enabled ?? true,
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
          profilePhotoPath: path,
        }
      : undefined,
  };
}

function mapInteraction(row: Record<string, unknown>): Interaction {
  return {
    id: row.id as string,
    personId: row.person_id as string,
    userId: row.user_id as string,
    type: row.type as Interaction["type"],
    occurredAt: row.occurred_at as string,
    note: (row.note as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    sourceUpdateId: (row.source_update_id as string | null) ?? null,
  };
}

function mapPersonUpdate(row: PersonUpdateRow): PersonUpdate {
  return {
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
  };
}

async function getPeopleRemote() {
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
  return cachePeopleAvatars(
    rows.map((row) => mapPerson(row, avatarUrls)),
  );
}

async function getFollowUpsRemote() {
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
  return cacheFollowUpAvatars(
    rows.map((row) => mapFollowUp(row, avatarUrls)),
  );
}

type OfflineDataset = {
  people: Person[];
  followUps: FollowUp[];
  personDetails: Record<string, PersonDetails>;
};

const activeDatasetRefreshes = new Map<string, Promise<OfflineDataset>>();

async function getOfflineDatasetRemote(userId: string) {
  const activeRefresh = activeDatasetRefreshes.get(userId);
  if (activeRefresh) return activeRefresh;

  const refresh = (async () => {
    const [
      people,
      followUps,
      interactionsResult,
      updatesResult,
    ] = await Promise.all([
      getPeopleRemote(),
      getFollowUpsRemote(),
      supabase
        .from("interactions")
        .select("*")
        .order("occurred_at", { ascending: false }),
      supabase
        .from("person_updates")
        .select("*, person_update_people(person_id)")
        .order("recorded_at", { ascending: false }),
    ]);

    if (interactionsResult.error) throw interactionsResult.error;
    if (
      updatesResult.error &&
      !isMissingUpdatesSchema(updatesResult.error.code)
    ) {
      throw updatesResult.error;
    }

    const interactions = (
      interactionsResult.data as Record<string, unknown>[]
    ).map(mapInteraction);
    const updates = (
      (updatesResult.data || []) as PersonUpdateRow[]
    ).map(mapPersonUpdate);
    const personDetails = Object.fromEntries(
      people.map((person) => [
        person.id,
        {
          person,
          interactions: interactions.filter(
            (interaction) => interaction.personId === person.id,
          ),
          followUps: followUps.filter(
            (followUp) => followUp.personId === person.id,
          ),
          updates: updates.filter((update) =>
            update.personIds.includes(person.id),
          ),
        } satisfies PersonDetails,
      ]),
    );

    return { people, followUps, personDetails };
  })().finally(() => {
    activeDatasetRefreshes.delete(userId);
  });

  activeDatasetRefreshes.set(userId, refresh);
  return refresh;
}

/**
 * A universal link opened from the web carries the readable slug rather than
 * the uuid, so it has to be translated before anything is queried by id.
 */
async function remotePersonId(identifier: string) {
  if (looksLikeUuid(identifier)) return identifier;
  const people = await getPeopleRemote();
  const match = people.find(({ slug }) => slug === identifier);
  if (!match) throw new Error("This person could not be found.");
  return match.id;
}

async function getPersonDetailsRemote(identifier: string) {
  const personId = await remotePersonId(identifier);
  const [people, interactionsResult, followUpsResult] = await Promise.all([
    getPeopleRemote(),
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

  const interactions = (
    interactionsResult.data as Record<string, unknown>[]
  ).map(mapInteraction);
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
  const updates = (
    (updatesResult.data || []) as PersonUpdateRow[]
  ).map(mapPersonUpdate);

  return {
    person,
    interactions,
    followUps: await cacheFollowUpAvatars(
      followUpRows.map((row) => mapFollowUp(row, avatarUrls)),
    ),
    updates,
  } satisfies PersonDetails;
}

export async function getPeople() {
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in to see your people.");
  const snapshot = await getOfflineSnapshot(userId);

  if (!(await isOnline())) return snapshot.people;

  try {
    if (!(await flushOfflineMutations(userId))) {
      return (await getOfflineSnapshot(userId)).people;
    }
    const dataset = await getOfflineDatasetRemote(userId);
    await updateOfflineSnapshot(userId, (current) => ({
      ...current,
      ...dataset,
    }));
    return dataset.people;
  } catch (error) {
    if (snapshot.people.length > 0) return snapshot.people;
    throw error;
  }
}

export async function getFollowUps() {
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in to see your follow-ups.");
  const snapshot = await getOfflineSnapshot(userId);

  if (!(await isOnline())) return snapshot.followUps;

  try {
    if (!(await flushOfflineMutations(userId))) {
      return (await getOfflineSnapshot(userId)).followUps;
    }
    const dataset = await getOfflineDatasetRemote(userId);
    await updateOfflineSnapshot(userId, (current) => ({
      ...current,
      ...dataset,
    }));
    return dataset.followUps;
  } catch (error) {
    if (snapshot.followUps.length > 0) return snapshot.followUps;
    throw error;
  }
}

export async function getPersonDetails(identifier: string) {
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in to see this person.");
  const snapshot = await getOfflineSnapshot(userId);
  // A link may arrive as either the uuid or the readable slug.
  const personId = looksLikeUuid(identifier)
    ? identifier
    : snapshot.people.find(({ slug }) => slug === identifier)?.id ?? identifier;
  const cached = snapshot.personDetails[personId];

  if (!(await isOnline())) {
    if (cached) return cached;
    const person = snapshot.people.find(({ id }) => id === personId);
    if (!person) throw new Error("This person is not available offline yet.");
    return {
      person,
      interactions: [],
      followUps: snapshot.followUps.filter(
        (followUp) => followUp.personId === personId,
      ),
      updates: [],
    };
  }

  try {
    if (!(await flushOfflineMutations(userId))) {
      const current = await getOfflineSnapshot(userId);
      const currentDetails = current.personDetails[personId];
      if (currentDetails) return currentDetails;
    }
    const details = await getPersonDetailsRemote(personId);
    // The cache is always keyed by uuid, even when the link carried a slug.
    const resolvedId = details.person.id;
    await updateOfflineSnapshot(userId, (current) => ({
      ...current,
      people: current.people.some(({ id }) => id === resolvedId)
        ? current.people.map((person) =>
            person.id === resolvedId ? details.person : person,
          )
        : [details.person, ...current.people],
      personDetails: {
        ...current.personDetails,
        [resolvedId]: details,
      },
    }));
    return details;
  } catch (error) {
    if (cached) return cached;
    throw error;
  }
}

async function uploadProfilePhoto(
  userId: string,
  photo: { uri: string; fileName?: string | null; mimeType?: string | null },
  objectId = Crypto.randomUUID(),
) {
  const extension =
    photo.fileName?.split(".").pop()?.toLowerCase() ||
    photo.mimeType?.split("/").pop() ||
    "jpg";
  const filePath = `${userId}/${objectId}.${extension}`;
  const response = await fetch(photo.uri);
  const arrayBuffer = await response.arrayBuffer();
  const { error } = await supabase.storage
    .from("avatars")
    .upload(filePath, arrayBuffer, {
      cacheControl: "3600",
      contentType: photo.mimeType || "image/jpeg",
      upsert: true,
    });
  if (error) throw error;
  return filePath;
}

function optimisticPerson(
  userId: string,
  personId: string,
  input: PersonInput,
  now: string,
  profilePhotoUrl: string | null,
  profilePhotoPath: string | null,
  current?: Person,
): Person {
  return {
    id: personId,
    // The server mints the slug when this row reaches it; until then the uuid
    // is what links to this person.
    slug: current?.slug ?? null,
    userId,
    fullName: input.fullName,
    preferredName: input.preferredName,
    profilePhotoUrl,
    profilePhotoPath,
    instagramUsername: input.instagramUsername,
    phoneNumber: input.phoneNumber,
    email: input.email,
    birthday: input.birthday,
    hometown: input.hometown,
    dormOrResidence: input.dormOrResidence,
    major: input.major,
    graduationYear: input.graduationYear ?? null,
    relationshipStrength: input.relationshipStrength,
    relationshipLabel: input.relationshipLabel ?? null,
    remindersEnabled: input.remindersEnabled ?? true,
    reminderIntervalDays: input.reminderIntervalDays ?? null,
    status: current?.status ?? "active",
    firstMetAt: input.firstMetAt ?? current?.firstMetAt ?? now,
    firstMetLocation: input.firstMetLocation,
    generalNotes: input.generalNotes,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    lastInteractionAt: current?.lastInteractionAt ?? now,
    tags: current?.tags ?? [],
  };
}

export async function createPerson(
  userId: string,
  input: PersonInput,
  photo?: { uri: string; fileName?: string | null; mimeType?: string | null },
) {
  const person = personInputSchema.parse(input);
  const personId = Crypto.randomUUID();
  const interactionId = Crypto.randomUUID();
  const mutationId = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const queuedPhoto = await persistPhotoForQueue(mutationId, photo);
  const createdPerson = optimisticPerson(
    userId,
    personId,
    person,
    createdAt,
    queuedPhoto?.uri ?? null,
    null,
  );
  const details: PersonDetails = {
    person: createdPerson,
    interactions: [
      {
        id: interactionId,
        personId,
        userId,
        type: "met",
        occurredAt: createdAt,
        note: person.firstMetLocation,
        createdAt,
        updatedAt: createdAt,
        sourceUpdateId: null,
      },
    ],
    followUps: [],
    updates: [],
  };

  await enqueueOfflineMutation({
    id: mutationId,
    kind: "create-person",
    userId,
    createdAt,
    personId,
    interactionId,
    input: person,
    photo: queuedPhoto,
  });
  await updateOfflineSnapshot(userId, (snapshot) => ({
    ...snapshot,
    people: [createdPerson, ...snapshot.people],
    personDetails: {
      ...snapshot.personDetails,
      [personId]: details,
    },
  }));
  void flushOfflineMutations(userId);

  return createdPerson;
}

export async function updatePerson(
  userId: string,
  personId: string,
  input: PersonInput,
  photo?: { uri: string; fileName?: string | null; mimeType?: string | null },
  currentPhotoPath?: string | null,
) {
  const person = personInputSchema.parse(input);
  const mutationId = Crypto.randomUUID();
  const queuedPhoto = await persistPhotoForQueue(mutationId, photo);
  const updatedAt = new Date().toISOString();
  let updatedPerson: Person | null = null;

  await enqueueOfflineMutation({
    id: mutationId,
    kind: "update-person",
    userId,
    createdAt: updatedAt,
    personId,
    input: person,
    photo: queuedPhoto,
    currentPhotoPath: currentPhotoPath ?? null,
  });
  await updateOfflineSnapshot(userId, (snapshot) => {
    const current =
      snapshot.people.find(({ id }) => id === personId) ??
      snapshot.personDetails[personId]?.person;
    if (!current) return snapshot;
    updatedPerson = optimisticPerson(
      userId,
      personId,
      person,
      updatedAt,
      queuedPhoto?.uri ?? current.profilePhotoUrl,
      queuedPhoto ? null : currentPhotoPath ?? current.profilePhotoPath,
      current,
    );

    return {
      ...snapshot,
      people: snapshot.people.map((item) =>
        item.id === personId ? updatedPerson! : item,
      ),
      personDetails: snapshot.personDetails[personId]
        ? {
            ...snapshot.personDetails,
            [personId]: {
              ...snapshot.personDetails[personId],
              person: updatedPerson,
            },
          }
        : snapshot.personDetails,
    };
  });
  void flushOfflineMutations(userId);

  return updatedPerson;
}

export async function createFollowUp(userId: string, input: FollowUpInput) {
  const followUp = followUpInputSchema.parse(input);
  const followUpId = Crypto.randomUUID();
  const mutationId = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  let createdFollowUp: FollowUp | null = null;

  await enqueueOfflineMutation({
    id: mutationId,
    kind: "create-follow-up",
    userId,
    createdAt,
    followUpId,
    input: followUp,
  });
  await updateOfflineSnapshot(userId, (snapshot) => {
    const person = snapshot.people.find(({ id }) => id === followUp.personId);
    createdFollowUp = {
      id: followUpId,
      personId: followUp.personId,
      userId,
      text: followUp.text,
      dueAt: followUp.dueAt,
      completedAt: null,
      createdAt,
      updatedAt: createdAt,
      person: person
        ? {
            id: person.id,
            fullName: person.fullName,
            preferredName: person.preferredName,
            profilePhotoUrl: person.profilePhotoUrl,
            profilePhotoPath: person.profilePhotoPath,
          }
        : undefined,
    };
    const details = snapshot.personDetails[followUp.personId];

    return {
      ...snapshot,
      followUps: [...snapshot.followUps, createdFollowUp!].sort((left, right) =>
        left.dueAt.localeCompare(right.dueAt),
      ),
      personDetails: details
        ? {
            ...snapshot.personDetails,
            [followUp.personId]: {
              ...details,
              followUps: [...details.followUps, createdFollowUp!],
            },
          }
        : snapshot.personDetails,
    };
  });
  void flushOfflineMutations(userId);
  return createdFollowUp;
}

export async function createInteraction(
  userId: string,
  input: InteractionInput,
) {
  const interaction = interactionInputSchema.parse(input);
  const interactionId = Crypto.randomUUID();
  const mutationId = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const createdInteraction: Interaction = {
    id: interactionId,
    personId: interaction.personId,
    userId,
    type: interaction.type,
    occurredAt: interaction.occurredAt,
    note: interaction.note,
    createdAt,
    updatedAt: createdAt,
    sourceUpdateId: null,
  };

  await enqueueOfflineMutation({
    id: mutationId,
    kind: "create-interaction",
    userId,
    createdAt,
    interactionId,
    input: interaction,
  });
  await updateOfflineSnapshot(userId, (snapshot) => {
    const details = snapshot.personDetails[interaction.personId];
    return {
      ...snapshot,
      people: snapshot.people.map((person) =>
        person.id === interaction.personId
          ? { ...person, lastInteractionAt: interaction.occurredAt }
          : person,
      ),
      personDetails: details
        ? {
            ...snapshot.personDetails,
            [interaction.personId]: {
              ...details,
              person: {
                ...details.person,
                lastInteractionAt: interaction.occurredAt,
              },
              interactions: [
                createdInteraction,
                ...details.interactions,
              ],
            },
          }
        : snapshot.personDetails,
    };
  });
  void flushOfflineMutations(userId);
  return createdInteraction;
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

export async function createPersonUpdate(
  userId: string,
  input: PersonUpdateInput,
) {
  const update = personUpdateInputSchema.parse(input);
  const updateId = Crypto.randomUUID();
  const mutationId = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const interactionIds = Object.fromEntries(
    update.personIds.map((personId) => [personId, Crypto.randomUUID()]),
  );
  const createdUpdate: PersonUpdate = {
    id: updateId,
    userId,
    text: update.text,
    recordedAt: update.recordedAt,
    isInteraction: update.isInteraction,
    interactionLabel: update.isInteraction
      ? update.interactionLabel || "Talked"
      : null,
    createdAt,
    updatedAt: createdAt,
    personIds: update.personIds,
  };

  await enqueueOfflineMutation({
    id: mutationId,
    kind: "create-person-update",
    userId,
    createdAt,
    updateId,
    interactionIds,
    input: update,
  });
  await updateOfflineSnapshot(userId, (snapshot) => {
    const personDetails = { ...snapshot.personDetails };
    for (const personId of update.personIds) {
      const details = personDetails[personId];
      if (!details) continue;
      const interaction: Interaction | null = update.isInteraction
        ? {
            id: interactionIds[personId],
            personId,
            userId,
            type: updateKind(update.interactionLabel),
            occurredAt: update.recordedAt,
            note: update.text,
            createdAt,
            updatedAt: createdAt,
            sourceUpdateId: updateId,
          }
        : null;
      personDetails[personId] = {
        ...details,
        person: update.isInteraction
          ? { ...details.person, lastInteractionAt: update.recordedAt }
          : details.person,
        updates: [createdUpdate, ...details.updates],
        interactions: interaction
          ? [interaction, ...details.interactions]
          : details.interactions,
      };
    }

    return {
      ...snapshot,
      people: snapshot.people.map((person) =>
        update.isInteraction && update.personIds.includes(person.id)
          ? { ...person, lastInteractionAt: update.recordedAt }
          : person,
      ),
      personDetails,
      recentUpdateTypes:
        update.isInteraction && update.interactionLabel
          ? Array.from(
              new Set([
                update.interactionLabel,
                ...snapshot.recentUpdateTypes,
              ]),
            ).slice(0, 30)
          : snapshot.recentUpdateTypes,
    };
  });
  void flushOfflineMutations(userId);
  return createdUpdate;
}

export async function getRecentUpdateTypes() {
  const userId = await currentUserId();
  if (!userId) return [];
  const snapshot = await getOfflineSnapshot(userId);
  if (!(await isOnline())) return snapshot.recentUpdateTypes;

  const { data, error } = await supabase
    .from("person_updates")
    .select("interaction_label")
    .eq("is_interaction", true)
    .not("interaction_label", "is", null)
    .order("recorded_at", { ascending: false })
    .limit(30);
  if (error && isMissingUpdatesSchema(error.code)) {
    return snapshot.recentUpdateTypes;
  }
  if (error) {
    if (snapshot.recentUpdateTypes.length > 0) {
      return snapshot.recentUpdateTypes;
    }
    throw error;
  }

  const recentUpdateTypes = Array.from(
    new Set(
      data
        .map((item) => item.interaction_label?.trim())
        .filter((label): label is string => Boolean(label)),
    ),
  );
  await updateOfflineSnapshot(userId, (current) => ({
    ...current,
    recentUpdateTypes,
  }));
  return recentUpdateTypes;
}

export async function setFollowUpComplete(
  followUpId: string,
  complete: boolean,
) {
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in to update this follow-up.");
  const completedAt = complete ? new Date().toISOString() : null;
  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "set-follow-up-complete",
    userId,
    createdAt: new Date().toISOString(),
    followUpId,
    completedAt,
  });
  await updateOfflineSnapshot(userId, (snapshot) => ({
    ...snapshot,
    followUps: snapshot.followUps.map((followUp) =>
      followUp.id === followUpId
        ? { ...followUp, completedAt, updatedAt: new Date().toISOString() }
        : followUp,
    ),
    personDetails: Object.fromEntries(
      Object.entries(snapshot.personDetails).map(([personId, details]) => [
        personId,
        {
          ...details,
          followUps: details.followUps.map((followUp) =>
            followUp.id === followUpId
              ? {
                  ...followUp,
                  completedAt,
                  updatedAt: new Date().toISOString(),
                }
              : followUp,
          ),
        },
      ]),
    ),
  }));
  void flushOfflineMutations(userId);
}

export async function archivePerson(personId: string) {
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in to archive this person.");
  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "archive-person",
    userId,
    createdAt: new Date().toISOString(),
    personId,
  });
  await updateOfflineSnapshot(userId, (snapshot) => ({
    ...snapshot,
    people: snapshot.people.map((person) =>
      person.id === personId ? { ...person, status: "archived" } : person,
    ),
    personDetails: snapshot.personDetails[personId]
      ? {
          ...snapshot.personDetails,
          [personId]: {
            ...snapshot.personDetails[personId],
            person: {
              ...snapshot.personDetails[personId].person,
              status: "archived",
            },
          },
        }
      : snapshot.personDetails,
  }));
  void flushOfflineMutations(userId);
}

export async function completeOnboarding(input: {
  userId: string;
  displayName: string;
  timezone: string;
  locale: string;
}) {
  const now = new Date().toISOString();
  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "complete-onboarding",
    userId: input.userId,
    createdAt: now,
    displayName: input.displayName.trim(),
    timezone: input.timezone,
    locale: input.locale,
  });
  await updateOfflineSnapshot(input.userId, (snapshot) => ({
    ...snapshot,
    profile: snapshot.profile
      ? {
          ...snapshot.profile,
          displayName: input.displayName.trim(),
          timezone: input.timezone,
          locale: input.locale,
          onboardingCompletedAt: now,
          updatedAt: now,
        }
      : snapshot.profile,
  }));
  await flushOfflineMutations(input.userId);
}

export async function getAccountSettings(userId: string) {
  const snapshot = await getOfflineSnapshot(userId);
  if (!(await isOnline())) {
    if (snapshot.accountSettings) return snapshot.accountSettings;
    throw new Error("Settings have not been cached on this phone yet.");
  }

  if (!(await flushOfflineMutations(userId)) && snapshot.accountSettings) {
    return snapshot.accountSettings;
  }
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
  if (error) {
    if (snapshot.accountSettings) return snapshot.accountSettings;
    throw error;
  }

  const accountSettings = {
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
  await updateOfflineSnapshot(userId, (current) => ({
    ...current,
    accountSettings,
  }));
  return accountSettings;
}

export async function saveAccountSettings(
  userId: string,
  timezone: string,
  intervals: ReminderDefaults = defaultReminderIntervals,
) {
  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "save-account-settings",
    userId,
    createdAt: new Date().toISOString(),
    timezone,
    intervals,
  });
  await updateOfflineSnapshot(userId, (snapshot) => ({
    ...snapshot,
    profile: snapshot.profile
      ? { ...snapshot.profile, timezone }
      : snapshot.profile,
    accountSettings: snapshot.accountSettings
      ? {
          ...snapshot.accountSettings,
          timezone,
          reminderDefaults: intervals,
        }
      : snapshot.accountSettings,
  }));
  void flushOfflineMutations(userId);
}

export async function saveNotificationPreferences(
  userId: string,
  preferences: Omit<
    NotificationPreference,
    "id" | "userId" | "createdAt" | "updatedAt"
  >,
) {
  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "save-notification-preferences",
    userId,
    createdAt: new Date().toISOString(),
    preferences,
  });
  await updateOfflineSnapshot(userId, (snapshot) => ({
    ...snapshot,
    accountSettings: snapshot.accountSettings
      ? {
          ...snapshot.accountSettings,
          notificationPreference: {
            ...snapshot.accountSettings.notificationPreference,
            ...preferences,
            updatedAt: new Date().toISOString(),
          },
        }
      : snapshot.accountSettings,
  }));
  void flushOfflineMutations(userId);
}

function personRecord(
  userId: string,
  personId: string,
  person: PersonInput,
  firstMetAt: string,
  profilePhotoPath: string | null,
) {
  return {
    id: personId,
    user_id: userId,
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
    relationship_label: person.relationshipLabel,
    reminders_enabled: person.remindersEnabled,
    reminder_interval_days: person.reminderIntervalDays,
    status: "active" as const,
    first_met_at: person.firstMetAt ?? firstMetAt,
    first_met_location: person.firstMetLocation,
    general_notes: person.generalNotes,
  };
}

async function executeOfflineMutation(mutation: OfflineMutation) {
  if (mutation.kind === "create-person") {
    const profilePhotoPath = mutation.photo
      ? await uploadProfilePhoto(
          mutation.userId,
          mutation.photo,
          mutation.personId,
        )
      : null;
    const { error: personError } = await supabase.from("people").upsert(
      personRecord(
        mutation.userId,
        mutation.personId,
        mutation.input,
        mutation.createdAt,
        profilePhotoPath,
      ),
      { onConflict: "id" },
    );
    if (personError) throw personError;

    const { error: interactionError } = await supabase
      .from("interactions")
      .upsert(
        {
          id: mutation.interactionId,
          user_id: mutation.userId,
          person_id: mutation.personId,
          type: "met",
          occurred_at: mutation.createdAt,
          note: mutation.input.firstMetLocation,
        },
        { onConflict: "id" },
      );
    if (interactionError) throw interactionError;
    await removeQueuedPhoto(mutation.photo);
    return;
  }

  if (mutation.kind === "update-person") {
    const newPhotoPath = mutation.photo
      ? await uploadProfilePhoto(
          mutation.userId,
          mutation.photo,
          `${mutation.personId}-${mutation.id}`,
        )
      : undefined;
    const { error } = await supabase
      .from("people")
      .update({
        full_name: mutation.input.fullName,
        preferred_name: mutation.input.preferredName,
        profile_photo_url:
          newPhotoPath ?? mutation.currentPhotoPath ?? null,
        instagram_username: mutation.input.instagramUsername,
        phone_number: mutation.input.phoneNumber,
        email: mutation.input.email,
        birthday: mutation.input.birthday,
        hometown: mutation.input.hometown,
        dorm_or_residence: mutation.input.dormOrResidence,
        major: mutation.input.major,
        graduation_year: mutation.input.graduationYear,
        relationship_strength: mutation.input.relationshipStrength,
        relationship_label: mutation.input.relationshipLabel,
        reminders_enabled: mutation.input.remindersEnabled,
        reminder_interval_days: mutation.input.reminderIntervalDays,
        ...(mutation.input.firstMetAt
          ? { first_met_at: mutation.input.firstMetAt }
          : {}),
        first_met_location: mutation.input.firstMetLocation,
        general_notes: mutation.input.generalNotes,
      })
      .eq("id", mutation.personId);
    if (error) throw error;
    if (newPhotoPath && mutation.currentPhotoPath) {
      await supabase.storage
        .from("avatars")
        .remove([mutation.currentPhotoPath]);
    }
    await removeQueuedPhoto(mutation.photo);
    return;
  }

  if (mutation.kind === "create-follow-up") {
    const { error } = await supabase.from("follow_ups").upsert(
      {
        id: mutation.followUpId,
        user_id: mutation.userId,
        person_id: mutation.input.personId,
        text: mutation.input.text,
        due_at: mutation.input.dueAt,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    return;
  }

  if (mutation.kind === "create-interaction") {
    const { error } = await supabase.from("interactions").upsert(
      {
        id: mutation.interactionId,
        user_id: mutation.userId,
        person_id: mutation.input.personId,
        type: mutation.input.type,
        occurred_at: mutation.input.occurredAt,
        note: mutation.input.note,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    return;
  }

  if (mutation.kind === "create-person-update") {
    const interactionLabel = mutation.input.isInteraction
      ? mutation.input.interactionLabel || "Talked"
      : null;
    const { error: updateError } = await supabase.from("person_updates").upsert(
      {
        id: mutation.updateId,
        user_id: mutation.userId,
        text: mutation.input.text,
        recorded_at: mutation.input.recordedAt,
        is_interaction: mutation.input.isInteraction,
        interaction_label: interactionLabel,
      },
      { onConflict: "id" },
    );
    if (updateError) throw updateError;

    const { error: peopleError } = await supabase
      .from("person_update_people")
      .upsert(
        mutation.input.personIds.map((personId) => ({
          update_id: mutation.updateId,
          person_id: personId,
          user_id: mutation.userId,
        })),
        {
          ignoreDuplicates: true,
          onConflict: "update_id,person_id",
        },
      );
    if (peopleError) throw peopleError;

    if (mutation.input.isInteraction) {
      const { error: interactionsError } = await supabase
        .from("interactions")
        .upsert(
          mutation.input.personIds.map((personId) => ({
            id: mutation.interactionIds[personId],
            user_id: mutation.userId,
            person_id: personId,
            type: updateKind(mutation.input.interactionLabel),
            occurred_at: mutation.input.recordedAt,
            note: mutation.input.text,
            source_update_id: mutation.updateId,
          })),
          { onConflict: "id" },
        );
      if (interactionsError) throw interactionsError;
    }
    return;
  }

  if (mutation.kind === "set-follow-up-complete") {
    const { error } = await supabase
      .from("follow_ups")
      .update({ completed_at: mutation.completedAt })
      .eq("id", mutation.followUpId);
    if (error) throw error;
    return;
  }

  if (mutation.kind === "archive-person") {
    const { error } = await supabase
      .from("people")
      .update({ status: "archived" })
      .eq("id", mutation.personId);
    if (error) throw error;
    return;
  }

  if (mutation.kind === "complete-onboarding") {
    const { error } = await supabase
      .from("user_profiles")
      .update({
        display_name: mutation.displayName,
        timezone: mutation.timezone,
        locale: mutation.locale,
        onboarding_completed_at: mutation.createdAt,
      })
      .eq("auth_user_id", mutation.userId);
    if (error) throw error;
    return;
  }

  if (mutation.kind === "save-account-settings") {
    const [profileResult, settingsResult] = await Promise.all([
      supabase
        .from("user_profiles")
        .update({ timezone: mutation.timezone })
        .eq("auth_user_id", mutation.userId),
      supabase
        .from("user_settings")
        .update({
          strength_1_days: mutation.intervals[1],
          strength_2_days: mutation.intervals[2],
          strength_3_days: mutation.intervals[3],
          strength_4_days: mutation.intervals[4],
        })
        .eq("user_id", mutation.userId),
    ]);
    const error = profileResult.error || settingsResult.error;
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("notification_preferences")
    .update({
      push_enabled: mutation.preferences.pushEnabled,
      overdue_contact_enabled:
        mutation.preferences.overdueContactEnabled,
      birthday_enabled: mutation.preferences.birthdayEnabled,
      follow_up_enabled: mutation.preferences.followUpEnabled,
      reminder_hour_local: mutation.preferences.reminderHourLocal,
      reminder_days_of_week:
        mutation.preferences.reminderDaysOfWeek,
    })
    .eq("user_id", mutation.userId);
  if (error) throw error;
}

const activeFlushes = new Map<string, Promise<boolean>>();

export async function flushOfflineMutations(userId?: string) {
  const resolvedUserId = userId ?? (await currentUserId());
  if (!resolvedUserId || !(await isOnline())) return false;
  const existing = activeFlushes.get(resolvedUserId);
  if (existing) return existing;

  const flush = (async () => {
    while (true) {
      const [mutation] = await getOfflineQueue(resolvedUserId);
      if (!mutation) return true;
      try {
        await executeOfflineMutation(mutation);
        await removeOfflineMutation(resolvedUserId, mutation.id);
      } catch {
        return false;
      }
    }
  })().finally(() => {
    activeFlushes.delete(resolvedUserId);
  });

  activeFlushes.set(resolvedUserId, flush);
  return flush;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function deleteAccount(
  session: Session,
  webUrl: string,
  appleAuthorizationCode?: string | null,
) {
  if (!webUrl) {
    throw new Error("Set the production web URL before deleting accounts.");
  }

  const response = await fetch(`${webUrl}/api/account`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      appleAuthorizationCode: appleAuthorizationCode || null,
    }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error || "The account could not be deleted.");
  }
  const result = (await response.json()) as {
    appleAuthorizationRevoked: boolean;
    ok: true;
  };
  await clearOfflineUserData(session.user.id);
  await supabase.auth.signOut({ scope: "local" });
  return result;
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
