import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Directory, File, Paths } from "expo-file-system";
import type { AccountSettings, PersonDetails } from "@/lib/data";
import type { ContactMethodDraft } from "@/lib/contact-methods";
import type { NoteText } from "@/lib/note-sync";
import type {
  FollowUp,
  NotificationPreference,
  Person,
  ReminderDefaults,
  UserProfile,
} from "@/lib/types";
import type {
  FollowUpInput,
  InteractionEdit,
  InteractionInput,
  PersonInput,
  PersonUpdateEdit,
  PersonUpdateInput,
} from "@/lib/validation";

export type QueuedPhoto = {
  uri: string;
  fileName: string | null;
  mimeType: string | null;
};

/**
 * The contact rows a person save carries. `knownIds` is what the form had on
 * screen when it opened, so a replay can tell a row the person deleted from
 * one added somewhere else while this sat in the queue. Both are optional
 * because a mutation queued by an older build has neither.
 */
export type QueuedContactMethods = {
  drafts: ContactMethodDraft[];
  knownIds: string[];
  /** The same rows by value, for a person whose contact rows do not exist yet
   * and therefore have no ids to remember. */
  knownValues?: { kind: ContactMethodDraft["kind"]; value: string }[];
};

export type OfflineMutation =
  | {
      id: string;
      kind: "create-person";
      userId: string;
      createdAt: string;
      personId: string;
      interactionId: string;
      input: PersonInput;
      photo: QueuedPhoto | null;
      contactMethods?: QueuedContactMethods;
    }
  | {
      id: string;
      kind: "update-person";
      userId: string;
      createdAt: string;
      personId: string;
      input: PersonInput;
      photo: QueuedPhoto | null;
      currentPhotoPath: string | null;
      contactMethods?: QueuedContactMethods;
    }
  | {
      id: string;
      kind: "create-person-note";
      userId: string;
      createdAt: string;
      personId: string;
      noteId: string;
      heading: string;
      body: string;
      position: number;
    }
  | {
      id: string;
      kind: "update-person-note";
      userId: string;
      createdAt: string;
      personId: string;
      noteId: string;
      position: number;
      /** What the section said when this edit began, so a replay can tell an
       * untouched section from one changed elsewhere in the meantime. */
      base: NoteText;
      heading: string;
      body: string;
    }
  | {
      id: string;
      kind: "delete-person-note";
      userId: string;
      createdAt: string;
      personId: string;
      noteId: string;
    }
  | {
      id: string;
      kind: "reorder-person-notes";
      userId: string;
      createdAt: string;
      personId: string;
      noteIds: string[];
    }
  | {
      id: string;
      kind: "create-follow-up";
      userId: string;
      createdAt: string;
      followUpId: string;
      input: FollowUpInput;
    }
  | {
      id: string;
      kind: "create-interaction";
      userId: string;
      createdAt: string;
      interactionId: string;
      input: InteractionInput;
    }
  | {
      id: string;
      kind: "create-person-update";
      userId: string;
      createdAt: string;
      updateId: string;
      interactionIds: Record<string, string>;
      input: PersonUpdateInput;
    }
  | {
      id: string;
      kind: "edit-person-update";
      userId: string;
      createdAt: string;
      updateId: string;
      /** What the row said when the edit was made, so a replay can tell that
       * somebody else has changed it since. */
      baseUpdatedAt: string | null;
      input: PersonUpdateEdit;
    }
  | {
      id: string;
      kind: "delete-person-update";
      userId: string;
      createdAt: string;
      updateId: string;
    }
  | {
      id: string;
      kind: "edit-interaction";
      userId: string;
      createdAt: string;
      interactionId: string;
      baseUpdatedAt: string | null;
      input: InteractionEdit;
    }
  | {
      id: string;
      kind: "delete-interaction";
      userId: string;
      createdAt: string;
      interactionId: string;
    }
  | {
      id: string;
      kind: "set-follow-up-complete";
      userId: string;
      createdAt: string;
      followUpId: string;
      completedAt: string | null;
    }
  | {
      id: string;
      kind: "archive-person";
      userId: string;
      createdAt: string;
      personId: string;
    }
  | {
      id: string;
      kind: "complete-onboarding";
      userId: string;
      createdAt: string;
      displayName: string;
      timezone: string;
      locale: string;
    }
  | {
      id: string;
      kind: "save-account-settings";
      userId: string;
      createdAt: string;
      timezone: string;
      intervals: ReminderDefaults;
    }
  | {
      id: string;
      kind: "save-notification-preferences";
      userId: string;
      createdAt: string;
      preferences: Omit<
        NotificationPreference,
        "id" | "userId" | "createdAt" | "updatedAt"
      >;
    };

export type OfflineSnapshot = {
  version: 1;
  userId: string;
  savedAt: string;
  profile: UserProfile | null;
  people: Person[];
  followUps: FollowUp[];
  personDetails: Record<string, PersonDetails>;
  accountSettings: AccountSettings | null;
  recentUpdateTypes: string[];
  recentCustomLabels: string[];
};

const cachePrefix = "siyi.offline.cache";
const queuePrefix = "siyi.offline.queue";
const mediaDirectory = new Directory(Paths.document, "siyi-offline-media");
const locks = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

function cacheKey(userId: string) {
  return `${cachePrefix}.${userId}`;
}

function queueKey(userId: string) {
  return `${queuePrefix}.${userId}`;
}

function emptySnapshot(userId: string): OfflineSnapshot {
  return {
    version: 1,
    userId,
    savedAt: new Date(0).toISOString(),
    profile: null,
    people: [],
    followUps: [],
    personDetails: {},
    accountSettings: null,
    recentUpdateTypes: [],
    recentCustomLabels: [],
  };
}

async function locked<T>(userId: string, operation: () => Promise<T>) {
  const previous = locks.get(userId) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const chain = previous.then(() => current);
  locks.set(userId, chain);
  await previous;

  try {
    return await operation();
  } finally {
    release();
    if (locks.get(userId) === chain) locks.delete(userId);
  }
}

function notifyListeners() {
  for (const listener of listeners) listener();
}

export function subscribeToOfflineStore(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function isOnline() {
  const state = await NetInfo.fetch();
  return Boolean(
    state.isConnected && state.isInternetReachable !== false,
  );
}

export async function getOfflineSnapshot(userId: string) {
  const stored = await AsyncStorage.getItem(cacheKey(userId));
  if (!stored) return emptySnapshot(userId);

  try {
    const parsed = JSON.parse(stored) as OfflineSnapshot;
    // Spreading over an empty snapshot means a cache written by an older build
    // simply has no value for a field this one added, rather than undefined.
    return parsed.version === 1 && parsed.userId === userId
      ? { ...emptySnapshot(userId), ...parsed }
      : emptySnapshot(userId);
  } catch {
    return emptySnapshot(userId);
  }
}

export async function updateOfflineSnapshot(
  userId: string,
  update: (snapshot: OfflineSnapshot) => OfflineSnapshot,
) {
  const snapshot = await locked(userId, async () => {
    const current = await getOfflineSnapshot(userId);
    const next = {
      ...update(current),
      savedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(cacheKey(userId), JSON.stringify(next));
    return next;
  });
  notifyListeners();
  return snapshot;
}

export async function getOfflineQueue(userId: string) {
  const stored = await AsyncStorage.getItem(queueKey(userId));
  if (!stored) return [] as OfflineMutation[];

  try {
    return JSON.parse(stored) as OfflineMutation[];
  } catch {
    return [] as OfflineMutation[];
  }
}

export async function enqueueOfflineMutation(mutation: OfflineMutation) {
  await locked(mutation.userId, async () => {
    const queue = await getOfflineQueue(mutation.userId);
    if (queue.some(({ id }) => id === mutation.id)) return;
    await AsyncStorage.setItem(
      queueKey(mutation.userId),
      JSON.stringify([...queue, mutation]),
    );
  });
  notifyListeners();
}

export async function removeOfflineMutation(userId: string, mutationId: string) {
  await locked(userId, async () => {
    const queue = await getOfflineQueue(userId);
    await AsyncStorage.setItem(
      queueKey(userId),
      JSON.stringify(queue.filter(({ id }) => id !== mutationId)),
    );
  });
  notifyListeners();
}

export async function pendingOfflineMutationCount(userId: string) {
  return (await getOfflineQueue(userId)).length;
}

export async function persistPhotoForQueue(
  mutationId: string,
  photo?: { uri: string; fileName?: string | null; mimeType?: string | null },
) {
  if (!photo) return null;
  if (!mediaDirectory.exists) {
    mediaDirectory.create({ idempotent: true, intermediates: true });
  }

  const extension =
    photo.fileName?.split(".").pop()?.toLowerCase() ||
    photo.mimeType?.split("/").pop()?.toLowerCase() ||
    "jpg";
  const destination = new File(mediaDirectory, `${mutationId}.${extension}`);
  await new File(photo.uri).copy(destination, { overwrite: true });

  return {
    uri: destination.uri,
    fileName: photo.fileName ?? destination.name,
    mimeType: photo.mimeType ?? null,
  } satisfies QueuedPhoto;
}

export async function removeQueuedPhoto(photo: QueuedPhoto | null) {
  if (!photo?.uri.startsWith(mediaDirectory.uri)) return;
  const file = new File(photo.uri);
  if (file.exists) file.delete();
}

export async function clearOfflineUserData(userId: string) {
  const queue = await getOfflineQueue(userId);
  await Promise.all(
    queue.map((mutation) =>
      "photo" in mutation ? removeQueuedPhoto(mutation.photo) : undefined,
    ),
  );

  const avatarDirectory = new Directory(
    Paths.document,
    "siyi-avatar-cache",
  );
  if (avatarDirectory.exists) {
    for (const entry of avatarDirectory.list()) {
      if (entry.name.startsWith(`${userId}_`)) entry.delete();
    }
  }

  await AsyncStorage.multiRemove([cacheKey(userId), queueKey(userId)]);
  notifyListeners();
}
