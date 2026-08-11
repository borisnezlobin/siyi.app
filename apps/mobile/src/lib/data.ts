import { normalizeOwnCard, type OwnCard } from "@/lib/own-card";
import { authenticatedWebRequest } from "@/lib/web-api";
import {
  defaultNoteHeadings,
  type ProposalFieldName,
  type ProposalPerson,
  type ProposalSection,
  type UpdateProposal,
} from "@/lib/update-proposal";
import type { Session } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  defaultReminderIntervals,
  unavailableNoteSections,
  type Reminder,
  type Interaction,
  type NotificationPreference,
  type Person,
  type PersonNote,
  type PersonNoteSections,
  type PersonUpdate,
  type RelationshipStrength,
  type ReminderDefaults,
  type Tag,
} from "@/lib/types";
import {
  contactMethodKinds,
  isContactMethodKind,
  normalizeContactDrafts,
  resolveContactDrafts,
  unavailableContactMethods,
  type ContactMethod,
  type ContactMethodDraft,
  type ContactMethodKind,
  type PersonContactMethods,
} from "@/lib/contact-methods";
import {
  planContactMethodRows,
  type StoredContactMethodRow,
} from "@/lib/contact-method-sync";
import {
  maxNoteBodyLength,
  maxNoteHeadingLength,
  maxNoteSectionsPerPerson,
  moveNoteSection,
  nextNotePosition,
  normalizeNoteHeading,
  orderedNoteSections,
} from "@/lib/note-sections";
import { resolveNoteConflict } from "@/lib/note-sync";
import { looksLikeUuid } from "@/lib/person-links";
import { supabase } from "@/lib/supabase";
import {
  clearOfflineUserData,
  enqueueOfflineMutation,
  type QueuedContactMethods,
  getOfflineQueue,
  getOfflineSnapshot,
  isOnline,
  persistPhotoForQueue,
  removeOfflineMutation,
  removeQueuedPhoto,
  updateOfflineSnapshot,
  type OfflineMutation,
  type OfflineSnapshot,
} from "@/lib/offline-store";
import {
  reminderEditSchema,
  reminderInputSchema,
  importPreviewSchema,
  interactionEditSchema,
  interactionInputSchema,
  personUpdateEditSchema,
  personUpdateInputSchema,
  personInputSchema,
  type ReminderInput,
  type InteractionEdit,
  type InteractionInput,
  type PersonUpdateEdit,
  type PersonUpdateInput,
  type PersonInput,
} from "@/lib/validation";
import { writeTolerantOfPendingColumns } from "@/lib/pending-columns";
import { interactionLabels } from "@/lib/interaction-labels";
import {
  isQueuedUpdateMutation,
  ownedByUpdateMessage,
  replayQueuedUpdateMutation,
  type UpdateWriteClient,
} from "@/lib/update-writes";
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
  // Absent from every read until migration 0014 has run.
  university?: string | null;
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

type ReminderRow = {
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
  reminders: Reminder[];
  updates: PersonUpdate[];
  /** Named note sections. Absent on anything cached by a build that predates
   * them, and unavailable until migration 0010 has been applied. */
  notes?: PersonNoteSections;
};

export function noteSectionsOf(details: PersonDetails | undefined) {
  return details?.notes ?? unavailableNoteSections;
}

export type AccountSettings = {
  timezone: string;
  reminderDefaults: ReminderDefaults;
  notificationPreference: NotificationPreference;
  ownCard: OwnCard;
  ownCardEnabled: boolean;
  defaultUniversity: string;
  marketingOptIn: boolean;
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

async function cacheReminderAvatars(reminders: Reminder[]) {
  return Promise.all(
    reminders.map(async (reminder) => {
      if (!reminder.person) return reminder;
      return {
        ...reminder,
        person: {
          ...reminder.person,
          profilePhotoUrl: await cachedAvatarUrl(
            reminder.person.profilePhotoUrl,
            reminder.person.profilePhotoPath,
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

type ContactMethodRow = {
  id: string;
  user_id: string;
  person_id: string;
  kind: string;
  value: string;
  label: string | null;
  position: number;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

/** Postgres codes for "that table or column is not there yet". */
/**
 * Every contact row this account owns. Reports itself unavailable rather than
 * throwing until migration 0013 has been applied on the server, and the phone
 * then shows the single phone, email and handle it always has.
 */
async function getContactMethodsRemote(): Promise<PersonContactMethods> {
  const { data, error } = await supabase
    .from("person_contact_methods")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const methods: ContactMethod[] = [];
  for (const row of (data ?? []) as ContactMethodRow[]) {
    if (!isContactMethodKind(row.kind)) continue;
    methods.push({
      id: row.id,
      userId: row.user_id,
      personId: row.person_id,
      kind: row.kind,
      value: row.value,
      label: row.label,
      position: row.position,
      isPrimary: row.is_primary,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
  return { available: true, methods };
}

type PersonNoteRow = {
  id: string;
  user_id: string;
  person_id: string;
  heading: string;
  body: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

function mapPersonNote(row: PersonNoteRow): PersonNote {
  return {
    id: row.id,
    userId: row.user_id,
    personId: row.person_id,
    heading: row.heading,
    body: row.body ?? "",
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Every named note section this account owns, in one query. Reports itself
 * unavailable rather than throwing until migration 0010 has been applied, and
 * the phone then shows only the untitled note it always has.
 */
async function getPersonNotesRemote(
  personId?: string,
): Promise<PersonNoteSections> {
  const query = supabase
    .from("person_notes")
    .select("*")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  const { data, error } = await (personId
    ? query.eq("person_id", personId)
    : query);

  if (error) {
    throw error;
  }

  return {
    available: true,
    sections: orderedNoteSections(
      ((data ?? []) as PersonNoteRow[]).map(mapPersonNote),
    ),
  };
}

function noteSectionsFor(
  notes: PersonNoteSections,
  personId: string,
): PersonNoteSections {
  return {
    available: notes.available,
    sections: notes.sections.filter((note) => note.personId === personId),
  };
}

function mapPerson(
  row: PersonRow,
  avatarUrls: Map<string, string>,
  storedContactMethods: PersonContactMethods = unavailableContactMethods,
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
    contactMethods: resolveContactDrafts(
      {
        phoneNumber: row.phone_number,
        email: row.email,
        instagramUsername: row.instagram_username,
      },
      {
        available: storedContactMethods.available,
        methods: storedContactMethods.methods.filter(
          (method) => method.personId === row.id,
        ),
      },
    ),
    birthday: row.birthday,
    hometown: row.hometown,
    dormOrResidence: row.dorm_or_residence,
    university: row.university ?? null,
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
  relation: ReminderRow["people"],
) {
  return Array.isArray(relation) ? relation[0] : relation;
}

function mapReminder(
  row: ReminderRow,
  avatarUrls: Map<string, string>,
): Reminder {
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
    customLabel: (row.custom_label as string | null) ?? null,
    customIcon: (row.custom_icon as string | null) ?? null,
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
  const [avatarUrls, contactMethods] = await Promise.all([
    signedAvatarUrls(rows.map((row) => row.profile_photo_url)),
    getContactMethodsRemote(),
  ]);
  return cachePeopleAvatars(
    rows.map((row) => mapPerson(row, avatarUrls, contactMethods)),
  );
}

async function getRemindersRemote() {
  const { data, error } = await supabase
    .from("reminders")
    .select("*, people(id,full_name,preferred_name,profile_photo_url)")
    .order("due_at", { ascending: true });
  if (error) throw error;

  const rows = data as ReminderRow[];
  const avatarUrls = await signedAvatarUrls(
    rows.map(
      (row) => relatedPerson(row.people)?.profile_photo_url || null,
    ),
  );
  return cacheReminderAvatars(
    rows.map((row) => mapReminder(row, avatarUrls)),
  );
}

type OfflineDataset = {
  people: Person[];
  reminders: Reminder[];
  personDetails: Record<string, PersonDetails>;
};

const activeDatasetRefreshes = new Map<string, Promise<OfflineDataset>>();

async function getOfflineDatasetRemote(userId: string) {
  const activeRefresh = activeDatasetRefreshes.get(userId);
  if (activeRefresh) return activeRefresh;

  const refresh = (async () => {
    const [
      people,
      reminders,
      notes,
      interactionsResult,
      updatesResult,
    ] = await Promise.all([
      getPeopleRemote(),
      getRemindersRemote(),
      getPersonNotesRemote(),
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
    if (updatesResult.error) throw updatesResult.error;

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
          reminders: reminders.filter(
            (reminder) => reminder.personId === person.id,
          ),
          updates: updates.filter((update) =>
            update.personIds.includes(person.id),
          ),
          notes: noteSectionsFor(notes, person.id),
        } satisfies PersonDetails,
      ]),
    );

    return { people, reminders, personDetails };
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
  const [people, notes, interactionsResult, remindersResult] = await Promise.all([
    getPeopleRemote(),
    getPersonNotesRemote(personId),
    supabase
      .from("interactions")
      .select("*")
      .eq("person_id", personId)
      .order("occurred_at", { ascending: false }),
    supabase
      .from("reminders")
      .select("*, people(id,full_name,preferred_name,profile_photo_url)")
      .eq("person_id", personId)
      .order("due_at", { ascending: true }),
  ]);

  if (interactionsResult.error) throw interactionsResult.error;
  if (remindersResult.error) throw remindersResult.error;
  const person = people.find(({ id }) => id === personId);
  if (!person) throw new Error("This person could not be found.");

  const interactions = (
    interactionsResult.data as Record<string, unknown>[]
  ).map(mapInteraction);
  const reminderRows = remindersResult.data as ReminderRow[];
  const avatarUrls = await signedAvatarUrls(
    reminderRows.map(
      (row) => relatedPerson(row.people)?.profile_photo_url || null,
    ),
  );

  const updatesResult = await supabase
    .from("person_updates")
    .select("*, person_update_people!inner(person_id)")
    .eq("person_update_people.person_id", personId)
    .order("recorded_at", { ascending: false });
  if (updatesResult.error) {
    throw updatesResult.error;
  }
  const updates = (
    (updatesResult.data || []) as PersonUpdateRow[]
  ).map(mapPersonUpdate);

  return {
    person,
    interactions,
    reminders: await cacheReminderAvatars(
      reminderRows.map((row) => mapReminder(row, avatarUrls)),
    ),
    updates,
    notes,
  } satisfies PersonDetails;
}

/**
 * What is already on the device, with no network involved. Screens draw this
 * first so an "info page" whose contents were saved long ago appears at once
 * instead of waiting on a refresh of the whole dataset.
 */
/** The signed-in user id, for the cache layer's own bookkeeping. */
export async function currentUserIdForCache() {
  return currentUserId();
}

export async function getPersonDetailsCached(
  identifier: string,
): Promise<PersonDetails | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const snapshot = await getOfflineSnapshot(userId);
  const personId = looksLikeUuid(identifier)
    ? identifier
    : snapshot.people.find(({ slug }) => slug === identifier)?.id ?? identifier;
  return snapshot.personDetails[personId] ?? null;
}

export async function getPeopleCached(): Promise<Person[] | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const snapshot = await getOfflineSnapshot(userId);
  return snapshot.people.length > 0 ? snapshot.people : null;
}

export async function getRemindersCached(): Promise<Reminder[] | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const snapshot = await getOfflineSnapshot(userId);
  return snapshot.reminders.length > 0 ? snapshot.reminders : null;
}

export async function getAccountSettingsCached(
  userId: string,
): Promise<AccountSettings | null> {
  const snapshot = await getOfflineSnapshot(userId);
  return snapshot.accountSettings;
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

export async function getReminders() {
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in to see your reminders.");
  const snapshot = await getOfflineSnapshot(userId);

  if (!(await isOnline())) return snapshot.reminders;

  try {
    if (!(await flushOfflineMutations(userId))) {
      return (await getOfflineSnapshot(userId)).reminders;
    }
    const dataset = await getOfflineDatasetRemote(userId);
    await updateOfflineSnapshot(userId, (current) => ({
      ...current,
      ...dataset,
    }));
    return dataset.reminders;
  } catch (error) {
    if (snapshot.reminders.length > 0) return snapshot.reminders;
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
      reminders: snapshot.reminders.filter(
        (reminder) => reminder.personId === personId,
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
  contactMethods?: ContactMethodDraft[],
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
    contactMethods,
    birthday: input.birthday,
    hometown: input.hometown,
    dormOrResidence: input.dormOrResidence,
    university: input.university ?? null,
    major: input.major,
    graduationYear: input.graduationYear ?? null,
    relationshipStrength: input.relationshipStrength,
    relationshipLabel: input.relationshipLabel ?? null,
    remindersEnabled: input.remindersEnabled ?? true,
    reminderIntervalDays: input.reminderIntervalDays ?? null,
    status: input.status ?? current?.status ?? "active",
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
  contactMethods?: ContactMethodDraft[],
) {
  const person = personInputSchema.parse(input);
  const personId = Crypto.randomUUID();
  const interactionId = Crypto.randomUUID();
  const mutationId = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const queuedPhoto = await persistPhotoForQueue(mutationId, photo);
  const defaultNoteIds = defaultNoteHeadings.map(() => Crypto.randomUUID());
  const queuedContacts = queuedContactMethods(contactMethods, []);
  const createdPerson = optimisticPerson(
    userId,
    personId,
    person,
    createdAt,
    queuedPhoto?.uri ?? null,
    null,
    undefined,
    queuedContacts?.drafts,
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
        customLabel: null,
        customIcon: null,
        createdAt,
        updatedAt: createdAt,
        sourceUpdateId: null,
      },
    ],
    reminders: [],
    updates: [],
    // Somewhere to put things from the start, so an update that says "likes
    // snowboarding" has a heading to go under without inventing one.
    notes: {
      available: true,
      sections: defaultNoteHeadings.map((heading, position) => ({
        id: defaultNoteIds[position],
        userId,
        personId,
        heading,
        body: "",
        position,
        createdAt,
        updatedAt: createdAt,
      })),
    },
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
    contactMethods: queuedContacts,
  });
  for (const [position, heading] of defaultNoteHeadings.entries()) {
    await enqueueOfflineMutation({
      id: Crypto.randomUUID(),
      kind: "create-person-note",
      userId,
      createdAt,
      personId,
      noteId: defaultNoteIds[position],
      heading,
      body: "",
      position,
    });
  }
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
  contactMethods?: ContactMethodDraft[],
  knownContactMethods: ContactMethodDraft[] = [],
) {
  const person = personInputSchema.parse(input);
  const mutationId = Crypto.randomUUID();
  const queuedPhoto = await persistPhotoForQueue(mutationId, photo);
  const queuedContacts = queuedContactMethods(
    contactMethods,
    knownContactMethods,
  );
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
    contactMethods: queuedContacts,
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
      queuedContacts?.drafts ?? current.contactMethods,
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

export async function createReminder(userId: string, input: ReminderInput) {
  const reminder = reminderInputSchema.parse(input);
  const reminderId = Crypto.randomUUID();
  const mutationId = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  let createdReminder: Reminder | null = null;

  await enqueueOfflineMutation({
    id: mutationId,
    kind: "create-reminder",
    userId,
    createdAt,
    reminderId,
    input: reminder,
  });
  await updateOfflineSnapshot(userId, (snapshot) => {
    const person = snapshot.people.find(({ id }) => id === reminder.personId);
    createdReminder = {
      id: reminderId,
      personId: reminder.personId,
      userId,
      text: reminder.text,
      dueAt: reminder.dueAt,
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
    const details = snapshot.personDetails[reminder.personId];

    return {
      ...snapshot,
      reminders: [...snapshot.reminders, createdReminder!].sort((left, right) =>
        left.dueAt.localeCompare(right.dueAt),
      ),
      personDetails: details
        ? {
            ...snapshot.personDetails,
            [reminder.personId]: {
              ...details,
              reminders: [...details.reminders, createdReminder!],
            },
          }
        : snapshot.personDetails,
    };
  });
  void flushOfflineMutations(userId);
  return createdReminder;
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
    customLabel: interaction.customLabel,
    customIcon: interaction.customIcon,
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
            type: update.type ?? updateKind(update.interactionLabel),
            occurredAt: update.recordedAt,
            note: update.text,
            customLabel: update.customLabel,
            customIcon: update.customIcon,
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
      recentCustomLabels: update.customLabel
        ? Array.from(
            new Set([update.customLabel, ...snapshot.recentCustomLabels]),
          ).slice(0, 6)
        : snapshot.recentCustomLabels,
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

/**
 * The names the user has already given their own kinds of update, offered back
 * as one-tap suggestions. Reports none at all rather than throwing until
 * migration 0009 has been applied on the server.
 */
export async function getRecentCustomLabels(limit = 6): Promise<string[]> {
  const userId = await currentUserId();
  if (!userId) return [];
  const snapshot = await getOfflineSnapshot(userId);
  if (!(await isOnline())) return snapshot.recentCustomLabels;

  const { data, error } = await supabase
    .from("interactions")
    .select("custom_label,occurred_at")
    .not("custom_label", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(60);

  if (error) {
    if (error.code === "42703") return [];
    return snapshot.recentCustomLabels;
  }

  const seen: string[] = [];
  for (const row of data ?? []) {
    const label = (row.custom_label as string | null)?.trim();
    if (label && !seen.includes(label)) seen.push(label);
    if (seen.length === limit) break;
  }
  await updateOfflineSnapshot(userId, (current) => ({
    ...current,
    recentCustomLabels: seen,
  }));
  return seen;
}

function findCachedUpdate(
  snapshot: Awaited<ReturnType<typeof getOfflineSnapshot>>,
  updateId: string,
) {
  for (const details of Object.values(snapshot.personDetails)) {
    const match = details.updates.find(({ id }) => id === updateId);
    if (match) return match;
  }
  return null;
}

function findCachedInteraction(
  snapshot: Awaited<ReturnType<typeof getOfflineSnapshot>>,
  interactionId: string,
) {
  for (const details of Object.values(snapshot.personDetails)) {
    const match = details.interactions.find(({ id }) => id === interactionId);
    if (match) return match;
  }
  return null;
}

export async function editPersonUpdate(
  userId: string,
  updateId: string,
  input: PersonUpdateEdit,
) {
  const edit = personUpdateEditSchema.parse(input);
  const snapshot = await getOfflineSnapshot(userId);
  const cached = findCachedUpdate(snapshot, updateId);
  const editedAt = new Date().toISOString();

  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "edit-person-update",
    userId,
    createdAt: editedAt,
    updateId,
    baseUpdatedAt: cached?.updatedAt ?? null,
    input: edit,
  });
  await updateOfflineSnapshot(userId, (current) => ({
    ...current,
    personDetails: Object.fromEntries(
      Object.entries(current.personDetails).map(([personId, details]) => [
        personId,
        {
          ...details,
          updates: details.updates.map((update) =>
            update.id === updateId
              ? {
                  ...update,
                  text: edit.text,
                  recordedAt: edit.recordedAt,
                  interactionLabel: update.isInteraction
                    ? edit.customLabel || interactionLabels[edit.type]
                    : update.interactionLabel,
                  updatedAt: editedAt,
                }
              : update,
          ),
          interactions: details.interactions.map((interaction) =>
            interaction.sourceUpdateId === updateId
              ? {
                  ...interaction,
                  type: edit.type,
                  occurredAt: edit.recordedAt,
                  note: edit.text,
                  customLabel: edit.customLabel,
                  customIcon: edit.customIcon,
                  updatedAt: editedAt,
                }
              : interaction,
          ),
        },
      ]),
    ),
    recentCustomLabels: edit.customLabel
      ? Array.from(
          new Set([edit.customLabel, ...current.recentCustomLabels]),
        ).slice(0, 6)
      : current.recentCustomLabels,
  }));
  void flushOfflineMutations(userId);
}

export async function deletePersonUpdate(userId: string, updateId: string) {
  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "delete-person-update",
    userId,
    createdAt: new Date().toISOString(),
    updateId,
  });
  await updateOfflineSnapshot(userId, (current) => ({
    ...current,
    personDetails: Object.fromEntries(
      Object.entries(current.personDetails).map(([personId, details]) => [
        personId,
        {
          ...details,
          updates: details.updates.filter(({ id }) => id !== updateId),
          interactions: details.interactions.filter(
            (interaction) => interaction.sourceUpdateId !== updateId,
          ),
        },
      ]),
    ),
  }));
  void flushOfflineMutations(userId);
}

export async function editInteraction(
  userId: string,
  interactionId: string,
  input: InteractionEdit,
) {
  const edit = interactionEditSchema.parse(input);
  const snapshot = await getOfflineSnapshot(userId);
  const cached = findCachedInteraction(snapshot, interactionId);
  if (cached?.sourceUpdateId) throw new Error(ownedByUpdateMessage);
  const editedAt = new Date().toISOString();

  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "edit-interaction",
    userId,
    createdAt: editedAt,
    interactionId,
    baseUpdatedAt: cached?.updatedAt ?? null,
    input: edit,
  });
  await updateOfflineSnapshot(userId, (current) => ({
    ...current,
    personDetails: Object.fromEntries(
      Object.entries(current.personDetails).map(([personId, details]) => [
        personId,
        {
          ...details,
          interactions: details.interactions.map((interaction) =>
            interaction.id === interactionId
              ? {
                  ...interaction,
                  type: edit.type,
                  occurredAt: edit.occurredAt,
                  note: edit.note,
                  customLabel: edit.customLabel,
                  customIcon: edit.customIcon,
                  updatedAt: editedAt,
                }
              : interaction,
          ),
        },
      ]),
    ),
    recentCustomLabels: edit.customLabel
      ? Array.from(
          new Set([edit.customLabel, ...current.recentCustomLabels]),
        ).slice(0, 6)
      : current.recentCustomLabels,
  }));
  void flushOfflineMutations(userId);
}

export async function deleteInteraction(
  userId: string,
  interactionId: string,
) {
  const snapshot = await getOfflineSnapshot(userId);
  const cached = findCachedInteraction(snapshot, interactionId);
  if (cached?.sourceUpdateId) throw new Error(ownedByUpdateMessage);

  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "delete-interaction",
    userId,
    createdAt: new Date().toISOString(),
    interactionId,
  });
  await updateOfflineSnapshot(userId, (current) => ({
    ...current,
    personDetails: Object.fromEntries(
      Object.entries(current.personDetails).map(([personId, details]) => [
        personId,
        {
          ...details,
          interactions: details.interactions.filter(
            ({ id }) => id !== interactionId,
          ),
        },
      ]),
    ),
  }));
  void flushOfflineMutations(userId);
}

/**
 * One reminder changed, or dropped, everywhere the snapshot holds it: the flat
 * list and every person's own copy. Returning null from `change` removes it.
 */
function withReminderChanged(
  snapshot: OfflineSnapshot,
  reminderId: string,
  change: (reminder: Reminder) => Reminder | null,
): OfflineSnapshot {
  const apply = (reminders: Reminder[]) =>
    reminders.flatMap((reminder) => {
      if (reminder.id !== reminderId) return [reminder];
      const next = change(reminder);
      return next ? [next] : [];
    });

  return {
    ...snapshot,
    reminders: apply(snapshot.reminders),
    personDetails: Object.fromEntries(
      Object.entries(snapshot.personDetails).map(([personId, details]) => [
        personId,
        { ...details, reminders: apply(details.reminders) },
      ]),
    ),
  };
}

export async function setReminderComplete(
  reminderId: string,
  complete: boolean,
) {
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in to update this reminder.");
  const completedAt = complete ? new Date().toISOString() : null;
  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "set-reminder-complete",
    userId,
    createdAt: new Date().toISOString(),
    reminderId,
    completedAt,
  });
  await updateOfflineSnapshot(userId, (snapshot) => ({
    ...snapshot,
    reminders: snapshot.reminders.map((reminder) =>
      reminder.id === reminderId
        ? { ...reminder, completedAt, updatedAt: new Date().toISOString() }
        : reminder,
    ),
    personDetails: Object.fromEntries(
      Object.entries(snapshot.personDetails).map(([personId, details]) => [
        personId,
        {
          ...details,
          reminders: details.reminders.map((reminder) =>
            reminder.id === reminderId
              ? {
                  ...reminder,
                  completedAt,
                  updatedAt: new Date().toISOString(),
                }
              : reminder,
          ),
        },
      ]),
    ),
  }));
  void flushOfflineMutations(userId);
}

/** Reword a reminder, or move it to another day. */
export async function editReminder(
  reminderId: string,
  input: { text: string; dueAt: string },
) {
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in to update this reminder.");
  const parsed = reminderEditSchema.parse(input);
  const updatedAt = new Date().toISOString();

  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "update-reminder",
    userId,
    createdAt: updatedAt,
    reminderId,
    text: parsed.text,
    dueAt: parsed.dueAt,
  });
  await updateOfflineSnapshot(userId, (snapshot) =>
    withReminderChanged(snapshot, reminderId, (reminder) => ({
      ...reminder,
      text: parsed.text,
      dueAt: parsed.dueAt,
      updatedAt,
    })),
  );
  void flushOfflineMutations(userId);
}

export async function deleteReminder(reminderId: string) {
  const userId = await currentUserId();
  if (!userId) throw new Error("Sign in to delete this reminder.");

  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "delete-reminder",
    userId,
    createdAt: new Date().toISOString(),
    reminderId,
  });
  await updateOfflineSnapshot(userId, (snapshot) =>
    withReminderChanged(snapshot, reminderId, () => null),
  );
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
      .select("timezone,marketing_opt_in")
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
    // Absent until migration 0018 has run, so every one of these has a fallback.
    ownCard: normalizeOwnCard(settingsResult.data.own_card),
    ownCardEnabled: settingsResult.data.own_card_enabled ?? false,
    defaultUniversity: settingsResult.data.default_university ?? "",
    marketingOptIn: profileResult.data.marketing_opt_in ?? false,
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
      reminderEnabled: preferencesResult.data.follow_up_enabled,
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

/**
 * Your own details. Written straight through rather than queued: it is a
 * settings screen, it is small, and there is nothing to reconcile if two devices
 * disagree beyond last write wins.
 */
export async function saveOwnCard(
  userId: string,
  values: { card: OwnCard; enabled: boolean; defaultUniversity: string },
) {
  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: userId,
      own_card: normalizeOwnCard(values.card),
      own_card_enabled: values.enabled,
      default_university: values.defaultUniversity.trim() || null,
    },
    { onConflict: "user_id" },
  );
  if (error) throw error;

  await updateOfflineSnapshot(userId, (snapshot) => ({
    ...snapshot,
    accountSettings: snapshot.accountSettings
      ? {
          ...snapshot.accountSettings,
          ownCard: values.card,
          ownCardEnabled: values.enabled,
          defaultUniversity: values.defaultUniversity,
        }
      : snapshot.accountSettings,
  }));
}

/**
 * Consent, so it is written straight through rather than queued: agreeing to
 * marketing email while offline and having it apply silently later is not
 * consent anybody gave.
 */
export async function saveMarketingOptIn(userId: string, optIn: boolean) {
  const { error } = await supabase
    .from("user_profiles")
    .update({
      marketing_opt_in: optIn,
      marketing_opt_in_at: optIn ? new Date().toISOString() : null,
    })
    .eq("auth_user_id", userId);
  if (error) throw error;
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

/**
 * The contact rows a person save should carry, normalised once here so the
 * queue, the cache and the server all hold the same shape.
 */
function queuedContactMethods(
  drafts: ContactMethodDraft[] | undefined,
  known: ContactMethodDraft[],
): QueuedContactMethods | undefined {
  if (!drafts) return undefined;
  return {
    drafts: normalizeContactDrafts(drafts),
    knownIds: known
      .map((draft) => draft.id)
      .filter((id): id is string => Boolean(id)),
    knownValues: known.map(({ kind, value }) => ({ kind, value })),
  };
}

function replaceNoteSections(
  userId: string,
  personId: string,
  replace: (sections: PersonNote[]) => PersonNote[],
) {
  return updateOfflineSnapshot(userId, (snapshot) => {
    const details = snapshot.personDetails[personId];
    if (!details) return snapshot;
    const current = noteSectionsOf(details);
    return {
      ...snapshot,
      personDetails: {
        ...snapshot.personDetails,
        [personId]: {
          ...details,
          notes: {
            available: current.available,
            sections: orderedNoteSections(replace(current.sections)),
          },
        },
      },
    };
  });
}

async function cachedNoteSections(userId: string, personId: string) {
  const snapshot = await getOfflineSnapshot(userId);
  return noteSectionsOf(snapshot.personDetails[personId]).sections;
}

/**
 * The headings this user already wrote on other people, most recently touched
 * first, so adding a section is a tap rather than retyping "Interests" again.
 * Read from the cache, so it works with no signal.
 */
export async function getUsedNoteHeadings(
  userId: string,
  excludePersonId?: string,
) {
  const snapshot = await getOfflineSnapshot(userId);
  const notes = Object.values(snapshot.personDetails)
    .flatMap((details) => noteSectionsOf(details).sections)
    .filter((note) => note.personId !== excludePersonId)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  const headings: string[] = [];
  for (const note of notes) {
    const heading = normalizeNoteHeading(note.heading);
    if (!heading) continue;
    const alreadySeen = headings.some(
      (existing) => existing.toLowerCase() === heading.toLowerCase(),
    );
    if (!alreadySeen) headings.push(heading);
  }
  return headings;
}

export async function createPersonNote(
  userId: string,
  personId: string,
  heading: string,
  body = "",
) {
  const cleanHeading = normalizeNoteHeading(heading).slice(
    0,
    maxNoteHeadingLength,
  );
  if (!cleanHeading) throw new Error("Give the section a heading first.");

  const existing = await cachedNoteSections(userId, personId);
  if (existing.length >= maxNoteSectionsPerPerson) {
    throw new Error(
      `You can keep up to ${maxNoteSectionsPerPerson} sections on one person.`,
    );
  }

  const noteId = Crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const position = nextNotePosition(existing);
  const note: PersonNote = {
    id: noteId,
    userId,
    personId,
    heading: cleanHeading,
    body,
    position,
    createdAt,
    updatedAt: createdAt,
  };

  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "create-person-note",
    userId,
    createdAt,
    personId,
    noteId,
    heading: cleanHeading,
    body,
    position,
  });
  await replaceNoteSections(userId, personId, (sections) => [
    ...sections,
    note,
  ]);
  void flushOfflineMutations(userId);
  return note;
}

export async function savePersonNote(
  userId: string,
  note: PersonNote,
  draft: { heading: string; body: string },
) {
  const heading = normalizeNoteHeading(draft.heading).slice(
    0,
    maxNoteHeadingLength,
  );
  if (!heading) throw new Error("A section needs a heading.");
  const body = draft.body.slice(0, maxNoteBodyLength);
  const savedAt = new Date().toISOString();

  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "update-person-note",
    userId,
    createdAt: savedAt,
    personId: note.personId,
    noteId: note.id,
    position: note.position,
    base: { heading: note.heading, body: note.body },
    heading,
    body,
  });
  await replaceNoteSections(userId, note.personId, (sections) =>
    sections.map((section) =>
      section.id === note.id
        ? { ...section, heading, body, updatedAt: savedAt }
        : section,
    ),
  );
  void flushOfflineMutations(userId);
}

export async function deletePersonNote(userId: string, note: PersonNote) {
  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "delete-person-note",
    userId,
    createdAt: new Date().toISOString(),
    personId: note.personId,
    noteId: note.id,
  });
  await replaceNoteSections(userId, note.personId, (sections) =>
    sections.filter((section) => section.id !== note.id),
  );
  void flushOfflineMutations(userId);
}

export async function movePersonNote(
  userId: string,
  note: PersonNote,
  direction: "up" | "down",
) {
  const sections = await cachedNoteSections(userId, note.personId);
  const reordered = moveNoteSection(sections, note.id, direction);

  await enqueueOfflineMutation({
    id: Crypto.randomUUID(),
    kind: "reorder-person-notes",
    userId,
    createdAt: new Date().toISOString(),
    personId: note.personId,
    noteIds: reordered.map((section) => section.id),
  });
  await replaceNoteSections(userId, note.personId, () => reordered);
  void flushOfflineMutations(userId);
  return reordered;
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
    university: person.university,
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

/**
 * The phone still edits one number, one email and one handle — the primary of
 * each kind — so the value it saves has to reach the contact rows too, or the
 * web app carries on showing a number the person has just changed here. Any
 * extra rows added on the web are left alone. Does nothing at all until
 * migration 0013 has been applied.
 */
async function mirrorPrimaryContactMethods(
  userId: string,
  personId: string,
  input: Pick<PersonInput, "phoneNumber" | "email" | "instagramUsername">,
) {
  const { data, error } = await supabase
    .from("person_contact_methods")
    .select("*")
    .eq("person_id", personId);

  if (error) {
    throw error;
  }

  const existing = (data ?? []) as ContactMethodRow[];
  const primaryValues: Record<ContactMethodKind, string | null> = {
    phone: input.phoneNumber,
    email: input.email,
    instagram: input.instagramUsername,
    // Discord has no legacy column; it lives only in person_contact_methods.
    discord: null,
  };

  for (const kind of contactMethodKinds) {
    const value = primaryValues[kind]?.trim() || null;
    const ofKind = existing.filter((row) => row.kind === kind);
    const primary = ofKind.find((row) => row.is_primary) ?? ofKind[0];

    if (!value) {
      if (!primary) continue;
      // Clearing the field here drops only the primary. Anything else saved on
      // the web survives, and the next row takes over.
      await supabase
        .from("person_contact_methods")
        .delete()
        .eq("id", primary.id);
      const next = ofKind.find((row) => row.id !== primary.id);
      if (next) {
        await supabase
          .from("person_contact_methods")
          .update({ is_primary: true })
          .eq("id", next.id);
      }
      continue;
    }

    if (primary) {
      await supabase
        .from("person_contact_methods")
        .update({ value, is_primary: true })
        .eq("id", primary.id);
    } else {
      await supabase.from("person_contact_methods").insert({
        user_id: userId,
        person_id: personId,
        kind,
        value,
        position: 0,
        is_primary: true,
      });
    }
  }
}

/**
 * The rows these writes touch may not have custom_label or custom_icon yet, so
 * every one of them goes through the pending-column retry. The feature stays
 * dark until migration 0009 is applied; nothing else breaks.
 */
function supabaseUpdateWriteClient(userId: string): UpdateWriteClient {
  return {
    loadUpdate: async (updateId) => {
      const { data, error } = await supabase
        .from("person_updates")
        .select("id,is_interaction,text,updated_at")
        .eq("id", updateId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id as string,
        isInteraction: Boolean(data.is_interaction),
        text: (data.text as string) ?? "",
        updatedAt: data.updated_at as string,
      };
    },
    writeLinkedInteractions: async (updateId, fields) => {
      const { error } = await writeTolerantOfPendingColumns(
        {
          type: fields.type,
          occurred_at: fields.occurredAt,
          note: fields.note,
          custom_label: fields.customLabel,
          custom_icon: fields.customIcon,
        },
        (row) =>
          supabase
            .from("interactions")
            .update(row)
            .eq("source_update_id", updateId)
            .eq("user_id", userId)
            .select("id"),
      );
      if (error) throw error;
    },
    writeUpdate: async (updateId, fields) => {
      const { error } = await supabase
        .from("person_updates")
        .update({
          text: fields.text,
          recorded_at: fields.recordedAt,
          ...(fields.interactionLabel !== undefined && {
            interaction_label: fields.interactionLabel,
          }),
        })
        .eq("id", updateId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    deleteLinkedInteractions: async (updateId) => {
      const { error } = await supabase
        .from("interactions")
        .delete()
        .eq("source_update_id", updateId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    deleteUpdate: async (updateId) => {
      const { error } = await supabase
        .from("person_updates")
        .delete()
        .eq("id", updateId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    loadInteraction: async (interactionId) => {
      const { data, error } = await supabase
        .from("interactions")
        .select("id,source_update_id,note,updated_at")
        .eq("id", interactionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id as string,
        sourceUpdateId: (data.source_update_id as string | null) ?? null,
        note: (data.note as string | null) ?? null,
        updatedAt: data.updated_at as string,
      };
    },
    writeInteraction: async (interactionId, fields) => {
      const { error } = await writeTolerantOfPendingColumns(
        {
          type: fields.type,
          occurred_at: fields.occurredAt,
          note: fields.note,
          custom_label: fields.customLabel,
          custom_icon: fields.customIcon,
        },
        (row) =>
          supabase
            .from("interactions")
            .update(row)
            .eq("id", interactionId)
            .eq("user_id", userId)
            .select("id"),
      );
      if (error) throw error;
    },
    deleteInteraction: async (interactionId) => {
      const { error } = await supabase
        .from("interactions")
        .delete()
        .eq("id", interactionId)
        .eq("user_id", userId);
      if (error) throw error;
    },
  };
}

/**
 * Writes the whole set of contact rows a person save carried, keeping anything
 * added elsewhere while the save waited in the queue. Does nothing at all until
 * migration 0013 has been applied, and the single columns on `people` carry the
 * primary of each kind on their own until then.
 */
async function saveQueuedContactMethods(
  userId: string,
  personId: string,
  queued: QueuedContactMethods,
) {
  const { data, error } = await supabase
    .from("person_contact_methods")
    .select("*")
    .eq("person_id", personId);

  if (error) {
    throw error;
  }

  const plan = planContactMethodRows({
    userId,
    personId,
    drafts: queued.drafts,
    knownIds: queued.knownIds,
    knownValues: queued.knownValues,
    existingRows: (data ?? []) as StoredContactMethodRow[],
    newId: () => Crypto.randomUUID(),
  });

  if (plan.upserts.length > 0) {
    const { error: upsertError } = await supabase
      .from("person_contact_methods")
      .upsert(plan.upserts, { onConflict: "id" });
    if (upsertError) {
      throw upsertError;
    }
  }

  if (plan.deleteIds.length > 0) {
    const { error: deleteError } = await supabase
      .from("person_contact_methods")
      .delete()
      .eq("person_id", personId)
      .in("id", plan.deleteIds);
    if (deleteError) throw deleteError;
  }
}

async function writeQueuedContactMethods(
  mutation: Extract<
    OfflineMutation,
    { kind: "create-person" | "update-person" }
  >,
) {
  if (mutation.contactMethods) {
    await saveQueuedContactMethods(
      mutation.userId,
      mutation.personId,
      mutation.contactMethods,
    );
    return;
  }
  // Queued by a build that only ever edited one value per kind.
  await mirrorPrimaryContactMethods(
    mutation.userId,
    mutation.personId,
    mutation.input,
  );
}

async function executeNoteMutation(
  mutation: Extract<
    OfflineMutation,
    {
      kind:
        | "create-person-note"
        | "update-person-note"
        | "delete-person-note"
        | "reorder-person-notes";
    }
  >,
) {
  if (mutation.kind === "create-person-note") {
    const { error } = await supabase.from("person_notes").upsert(
      {
        id: mutation.noteId,
        user_id: mutation.userId,
        person_id: mutation.personId,
        heading: mutation.heading,
        body: mutation.body,
        position: mutation.position,
      },
      { onConflict: "id" },
    );
    if (error) throw error;
    return;
  }

  if (mutation.kind === "delete-person-note") {
    const { error } = await supabase
      .from("person_notes")
      .delete()
      .eq("id", mutation.noteId)
      .eq("user_id", mutation.userId);
    if (error) throw error;
    return;
  }

  if (mutation.kind === "reorder-person-notes") {
    for (const [position, noteId] of mutation.noteIds.entries()) {
      const { error } = await supabase
        .from("person_notes")
        .update({ position })
        .eq("id", noteId)
        .eq("person_id", mutation.personId)
        .eq("user_id", mutation.userId);
      if (error) {
        throw error;
      }
    }
    return;
  }

  const { data, error } = await supabase
    .from("person_notes")
    .select("heading,body")
    .eq("id", mutation.noteId)
    .eq("user_id", mutation.userId)
    .maybeSingle();
  if (error) {
    throw error;
  }

  const remote = data
    ? { heading: String(data.heading), body: data.body ?? "" }
    : null;
  const resolution = resolveNoteConflict({
    base: mutation.base,
    ours: { heading: mutation.heading, body: mutation.body },
    remote,
  });

  const { error: writeError } = remote
    ? await supabase
        .from("person_notes")
        .update({ heading: resolution.heading, body: resolution.body })
        .eq("id", mutation.noteId)
        .eq("user_id", mutation.userId)
    : // Deleted elsewhere while this edit waited. Put it back rather than
      // throwing away what the person wrote on their phone.
      await supabase.from("person_notes").insert({
        id: mutation.noteId,
        user_id: mutation.userId,
        person_id: mutation.personId,
        heading: resolution.heading,
        body: resolution.body,
        position: mutation.position,
      });
  if (writeError) {
    throw writeError;
  }

  if (!resolution.spillover) return;
  const { error: spilloverError } = await supabase
    .from("person_notes")
    .insert({
      user_id: mutation.userId,
      person_id: mutation.personId,
      heading: resolution.spillover.heading,
      body: resolution.spillover.body,
      position: mutation.position + 1,
    });
  if (spilloverError) {
    throw spilloverError;
  }
}

async function executeOfflineMutation(mutation: OfflineMutation) {
  if (
    mutation.kind === "create-person-note" ||
    mutation.kind === "update-person-note" ||
    mutation.kind === "delete-person-note" ||
    mutation.kind === "reorder-person-notes"
  ) {
    await executeNoteMutation(mutation);
    return;
  }

  if (mutation.kind === "create-person") {
    const profilePhotoPath = mutation.photo
      ? await uploadProfilePhoto(
          mutation.userId,
          mutation.photo,
          mutation.personId,
        )
      : null;
    const { error: personError } = await writeTolerantOfPendingColumns(
      personRecord(
        mutation.userId,
        mutation.personId,
        mutation.input,
        mutation.createdAt,
        profilePhotoPath,
      ),
      (row) => supabase.from("people").upsert(row, { onConflict: "id" }),
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
    await writeQueuedContactMethods(mutation);
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
    const { error } = await writeTolerantOfPendingColumns(
      {
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
        university: mutation.input.university,
        major: mutation.input.major,
        graduation_year: mutation.input.graduationYear,
        relationship_strength: mutation.input.relationshipStrength,
        relationship_label: mutation.input.relationshipLabel,
        reminders_enabled: mutation.input.remindersEnabled,
        reminder_interval_days: mutation.input.reminderIntervalDays,
        ...(mutation.input.firstMetAt
          ? { first_met_at: mutation.input.firstMetAt }
          : {}),
        ...(mutation.input.status ? { status: mutation.input.status } : {}),
        first_met_location: mutation.input.firstMetLocation,
        general_notes: mutation.input.generalNotes,
      },
      (row) =>
        supabase.from("people").update(row).eq("id", mutation.personId),
    );
    if (error) throw error;
    await writeQueuedContactMethods(mutation);
    if (newPhotoPath && mutation.currentPhotoPath) {
      await supabase.storage
        .from("avatars")
        .remove([mutation.currentPhotoPath]);
    }
    await removeQueuedPhoto(mutation.photo);
    return;
  }

  if (mutation.kind === "create-reminder") {
    const { error } = await supabase.from("reminders").upsert(
      {
        id: mutation.reminderId,
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
    const { error } = await writeTolerantOfPendingColumns(
      {
        id: mutation.interactionId,
        user_id: mutation.userId,
        person_id: mutation.input.personId,
        type: mutation.input.type,
        occurred_at: mutation.input.occurredAt,
        note: mutation.input.note,
        custom_label: mutation.input.customLabel,
        custom_icon: mutation.input.customIcon,
      },
      (row) => supabase.from("interactions").upsert(row, { onConflict: "id" }),
    );
    if (error) throw error;
    return;
  }

  if (isQueuedUpdateMutation(mutation)) {
    await replayQueuedUpdateMutation(
      supabaseUpdateWriteClient(mutation.userId),
      mutation,
    );
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
      const type =
        mutation.input.type ?? updateKind(mutation.input.interactionLabel);
      const { error: interactionsError } = await writeTolerantOfPendingColumns(
        {
          type,
          custom_label: mutation.input.customLabel,
          custom_icon: mutation.input.customIcon,
        },
        (shared) =>
          supabase.from("interactions").upsert(
            mutation.input.personIds.map((personId) => ({
              id: mutation.interactionIds[personId],
              user_id: mutation.userId,
              person_id: personId,
              occurred_at: mutation.input.recordedAt,
              note: mutation.input.text,
              source_update_id: mutation.updateId,
              ...shared,
            })),
            { onConflict: "id" },
          ),
      );
      if (interactionsError) throw interactionsError;
    }
    return;
  }

  if (mutation.kind === "set-reminder-complete") {
    const { error } = await supabase
      .from("reminders")
      .update({ completed_at: mutation.completedAt })
      .eq("id", mutation.reminderId);
    if (error) throw error;
    return;
  }

  if (mutation.kind === "update-reminder") {
    const { error } = await supabase
      .from("reminders")
      .update({ text: mutation.text, due_at: mutation.dueAt })
      .eq("id", mutation.reminderId);
    if (error) throw error;
    return;
  }

  if (mutation.kind === "delete-reminder") {
    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("id", mutation.reminderId);
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
      follow_up_enabled: mutation.preferences.reminderEnabled,
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
      reminders: preview.data.reminders.length,
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
      reminders: number;
      tags: number;
    };
  };
}

/**
 * Asking the server where an update belongs, for phones with no model of their
 * own. The person's details never leave here — the server reads them itself,
 * from rows it is already allowed to see.
 */
export async function classifyUpdateViaWeb(
  session: Session,
  webUrl: string,
  input: { personId: string; text: string },
): Promise<ClassifiedUpdate | null> {
  const response = await authenticatedWebRequest(
    session,
    webUrl,
    "/api/updates/classify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  const payload = (await response.json()) as ClassifiedUpdate & {
    proposal: UpdateProposal | null;
  };
  return payload.proposal ? payload : null;
}

export type ClassifiedUpdate = {
  proposal: UpdateProposal | null;
  person?: ProposalPerson;
  sections?: ProposalSection[];
  contact?: Partial<Record<ProposalFieldName, string | null>>;
};

/** Openings for a catch-up, for phones with no model of their own. */
export async function catchUpStartersViaWeb(
  session: Session,
  webUrl: string,
  personId: string,
): Promise<string[]> {
  const response = await authenticatedWebRequest(
    session,
    webUrl,
    "/api/catch-up/starters",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId }),
    },
  );
  const payload = (await response.json()) as { starters?: unknown };
  return Array.isArray(payload.starters)
    ? payload.starters.filter((entry): entry is string => typeof entry === "string")
    : [];
}
