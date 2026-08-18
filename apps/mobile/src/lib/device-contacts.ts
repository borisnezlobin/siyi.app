import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
import {
  Contact,
  ContactField,
  getPermissionsAsync,
  requestPermissionsAsync,
} from "expo-contacts";
import { brand } from "@/config/brand";
import {
  findContactMatch,
  planContactSync,
  type ContactConflict,
  type DeviceContact,
} from "@/lib/contact-matching";
import type { Person } from "@/lib/types";

const syncEnabledKey = `${brand.slug}.contacts.sync-enabled`;
const promptedKey = `${brand.slug}.contacts.prompted`;
const linkPrefix = `${brand.slug}.contacts.link`;
const runProgressKey = `${brand.slug}.contacts.run-progress`;

function linkKey(personId: string) {
  return `${linkPrefix}.${personId}`;
}

export async function isContactSyncEnabled() {
  return (await AsyncStorage.getItem(syncEnabledKey)) === "true";
}

export async function setContactSyncEnabled(enabled: boolean) {
  await AsyncStorage.setItem(syncEnabledKey, enabled ? "true" : "false");
}

/**
 * The permission prompt is a one-shot resource, so it is spent only after the
 * user has saved someone and the feature has a visible point.
 */
export async function hasBeenPromptedForContacts() {
  return (await AsyncStorage.getItem(promptedKey)) === "true";
}

export async function markContactsPrompted() {
  await AsyncStorage.setItem(promptedKey, "true");
}

export type ContactsPermissionState = {
  granted: boolean;
  /** False once the OS prompt has been spent — only device settings can change it. */
  canAskAgain: boolean;
};

export async function getContactsPermissionState(): Promise<ContactsPermissionState> {
  const response = await getPermissionsAsync();
  return { granted: response.granted, canAskAgain: response.canAskAgain };
}

export async function hasContactsPermission() {
  return (await getPermissionsAsync()).granted;
}

export async function requestContactsPermission() {
  await markContactsPrompted();
  const response = await requestPermissionsAsync();
  return { granted: response.granted, canAskAgain: response.canAskAgain };
}

export async function openDeviceSettings() {
  await Linking.openSettings();
}

const readFields = [
  ContactField.FULL_NAME,
  ContactField.GIVEN_NAME,
  ContactField.FAMILY_NAME,
  ContactField.PHONES,
  ContactField.EMAILS,
] as const;

export async function readDeviceContacts(): Promise<DeviceContact[]> {
  const details = await Contact.getAllDetails(readFields);
  return details.map((entry) => ({
    id: entry.id,
    name:
      entry.fullName ||
      [entry.givenName, entry.familyName].filter(Boolean).join(" "),
    phoneNumbers: (entry.phones ?? [])
      .map((phone) => phone.number ?? "")
      .filter(Boolean),
    emails: (entry.emails ?? [])
      .map((email) => email.address ?? "")
      .filter(Boolean),
  }));
}

export type ContactSyncResult =
  | { status: "created"; contactId: string; skipped: ContactConflict[] }
  | { status: "updated"; contactId: string; skipped: ContactConflict[] }
  | { status: "unchanged"; skipped: ContactConflict[] }
  | { status: "skipped"; reason: "disabled" | "no-permission" }
  | { status: "failed"; message: string };

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { givenName: fullName.trim(), familyName: "" };
  return {
    givenName: parts.slice(0, -1).join(" "),
    familyName: parts[parts.length - 1],
  };
}

/**
 * The address book as one person's sync sees it: the lightweight snapshot used
 * for matching, plus a lazily loaded index of writable contact instances. Both
 * are shared across a batch so a thousand people do not mean a thousand reads.
 */
type AddressBook = {
  contacts: DeviceContact[];
  writable: Map<string, Contact> | null;
};

/** What one person's write can come back as once access is already settled. */
type ContactWriteResult = Extract<
  ContactSyncResult,
  { status: "created" | "updated" | "unchanged" | "failed" }
>;

async function loadAddressBook(): Promise<AddressBook> {
  return { contacts: await readDeviceContacts(), writable: null };
}

async function writableContact(book: AddressBook, contactId: string) {
  if (!book.writable) {
    book.writable = new Map(
      (await Contact.getAll()).map((contact) => [contact.id, contact]),
    );
  }
  return book.writable.get(contactId);
}

/**
 * Records a freshly written contact in the local snapshot so the next person in
 * the same batch matches against reality rather than a stale read.
 */
function rememberWrite(
  book: AddressBook,
  contactId: string,
  name: string,
  phoneNumbers: string[],
  emails: string[],
) {
  const existing = book.contacts.find((contact) => contact.id === contactId);
  if (!existing) {
    book.contacts.push({ id: contactId, name, phoneNumbers, emails });
    return;
  }
  existing.phoneNumbers = [...existing.phoneNumbers, ...phoneNumbers];
  existing.emails = [...existing.emails, ...emails];
}

async function syncPersonWithBook(
  person: Person,
  book: AddressBook,
): Promise<ContactWriteResult> {
  try {
    const linkedId = await AsyncStorage.getItem(linkKey(person.id));
    const linked = linkedId
      ? book.contacts.find((contact) => contact.id === linkedId)
      : undefined;
    const match = linked
      ? ({ contact: linked, matchedOn: "phone" } as const)
      : findContactMatch(person, book.contacts);
    const plan = planContactSync(person, match);

    if (plan.action === "none") {
      return { status: "unchanged", skipped: plan.skipped };
    }

    if (plan.action === "create") {
      const { givenName, familyName } = splitName(plan.fields.name);
      const phoneNumbers = plan.fields.phoneNumbers ?? [];
      const emailAddresses = plan.fields.emails ?? [];
      const created = await Contact.create({
        givenName,
        familyName,
        ...(phoneNumbers.length
          ? {
              phones: phoneNumbers.map((number) => ({
                label: "mobile",
                number,
              })),
            }
          : {}),
        ...(emailAddresses.length
          ? {
              emails: emailAddresses.map((address) => ({
                label: "home",
                address,
              })),
            }
          : {}),
      });
      await AsyncStorage.setItem(linkKey(person.id), created.id);
      rememberWrite(
        book,
        created.id,
        plan.fields.name,
        phoneNumbers,
        emailAddresses,
      );
      return { status: "created", contactId: created.id, skipped: [] };
    }

    const target = await writableContact(book, plan.contactId);
    if (!target) {
      return {
        status: "failed",
        message: "That contact is no longer on this device.",
      };
    }

    const phoneNumbers = plan.fields.phoneNumbers ?? [];
    const emailAddresses = plan.fields.emails ?? [];
    for (const number of phoneNumbers) {
      await target.addPhone({ label: "mobile", number });
    }
    for (const address of emailAddresses) {
      await target.addEmail({ label: "home", address });
    }

    await AsyncStorage.setItem(linkKey(person.id), plan.contactId);
    rememberWrite(
      book,
      plan.contactId,
      plan.fields.name,
      phoneNumbers,
      emailAddresses,
    );
    return {
      status: "updated",
      contactId: plan.contactId,
      skipped: plan.skipped,
    };
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "Contact sync failed.",
    };
  }
}

/**
 * Pushes one person into the device phone book. Only ever adds what is missing;
 * see planContactSync for why an existing device value is never replaced.
 */
export async function syncPersonToDeviceContacts(
  person: Person,
): Promise<ContactSyncResult> {
  if (!(await isContactSyncEnabled())) {
    return { status: "skipped", reason: "disabled" };
  }
  if (!(await hasContactsPermission())) {
    return { status: "skipped", reason: "no-permission" };
  }

  try {
    return await syncPersonWithBook(person, await loadAddressBook());
  } catch (error) {
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "Contact sync failed.",
    };
  }
}

export type ContactSyncTally = {
  total: number;
  created: number;
  updated: number;
  /** Everyone the device kept as-is: created + updated + skipped === total. */
  skipped: number;
  /** Of the skipped: the device already had everything Siyi knows. */
  alreadyComplete: number;
  /** Of the skipped: the device had its own value, which was left alone. */
  keptDeviceValue: number;
  /** Of the skipped: something went wrong for that one person. */
  failed: number;
  /** Individual values left alone across everyone, updates included. */
  conflicts: number;
};

export type ContactSyncSummary = ContactSyncTally & {
  failures: { name: string; message: string }[];
  /** True when the run stopped early, so the numbers describe a partial pass. */
  interrupted: boolean;
};

export type ContactSyncProgress = {
  completed: number;
  total: number;
  currentName: string | null;
  tally: ContactSyncTally;
};

function emptyTally(total: number): ContactSyncTally {
  return {
    total,
    created: 0,
    updated: 0,
    skipped: 0,
    alreadyComplete: 0,
    keptDeviceValue: 0,
    failed: 0,
    conflicts: 0,
  };
}

type RunProgress = {
  doneIds: string[];
  tally: ContactSyncTally;
};

async function readRunProgress(): Promise<RunProgress | null> {
  const stored = await AsyncStorage.getItem(runProgressKey);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as RunProgress;
    return Array.isArray(parsed.doneIds) && parsed.tally ? parsed : null;
  } catch {
    return null;
  }
}

export async function clearInterruptedContactSync() {
  await AsyncStorage.removeItem(runProgressKey);
}

/** The people left over from a run that was killed mid-pass, if there was one. */
export async function interruptedContactSyncCount() {
  const progress = await readRunProgress();
  return progress ? progress.tally.total - progress.doneIds.length : 0;
}

/** Hands the frame back to the UI so a long pass never looks like a freeze. */
function yieldToInterface() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export type ContactSyncRunOptions = {
  onProgress?: (progress: ContactSyncProgress) => void;
  /** Returning false ends the pass cleanly and keeps the resume point. */
  shouldContinue?: () => boolean;
  /** Ignore a half-finished earlier run and start from the first person. */
  restart?: boolean;
};

/**
 * Walks every person into the phone book. Progress is written to storage as it
 * goes, so a pass the system kills in the background resumes where it stopped
 * instead of re-reading and re-planning a whole address book.
 */
export async function syncAllPeopleToDeviceContacts(
  people: Person[],
  options: ContactSyncRunOptions = {},
): Promise<ContactSyncSummary> {
  if (!(await isContactSyncEnabled()) || !(await hasContactsPermission())) {
    return { ...emptyTally(people.length), failures: [], interrupted: true };
  }

  const resumed = options.restart ? null : await readRunProgress();
  const done = new Set(
    resumed && resumed.tally.total === people.length ? resumed.doneIds : [],
  );
  const tally =
    done.size > 0 && resumed ? resumed.tally : emptyTally(people.length);
  tally.total = people.length;
  const failures: { name: string; message: string }[] = [];

  const report = (currentName: string | null) => {
    options.onProgress?.({
      completed: done.size,
      total: people.length,
      currentName,
      tally: { ...tally },
    });
  };

  report(null);

  const book = await loadAddressBook();

  for (const person of people) {
    if (done.has(person.id)) continue;
    if (options.shouldContinue && !options.shouldContinue()) {
      return { ...tally, failures, interrupted: true };
    }

    report(person.preferredName || person.fullName);
    const result = await syncPersonWithBook(person, book);

    if (result.status === "created") {
      tally.created += 1;
    } else if (result.status === "updated") {
      tally.updated += 1;
      tally.conflicts += result.skipped.length;
    } else if (result.status === "unchanged") {
      tally.skipped += 1;
      tally.conflicts += result.skipped.length;
      if (result.skipped.length > 0) tally.keptDeviceValue += 1;
      else tally.alreadyComplete += 1;
    } else {
      tally.skipped += 1;
      tally.failed += 1;
      failures.push({ name: person.fullName, message: result.message });
    }

    done.add(person.id);
    await AsyncStorage.setItem(
      runProgressKey,
      JSON.stringify({ doneIds: [...done], tally } satisfies RunProgress),
    );

    report(person.preferredName || person.fullName);
    if (done.size % 10 === 0) await yieldToInterface();
  }

  await clearInterruptedContactSync();
  return { ...tally, failures, interrupted: false };
}

export async function forgetContactLink(personId: string) {
  await AsyncStorage.removeItem(linkKey(personId));
}

/**
 * The photo on whichever device contact this person already matches.
 *
 * Free, private and instant compared with asking Instagram: the address book
 * is already on the phone, and the sync above has usually worked out which
 * contact belongs to whom. Only ever read — nothing is written back.
 */
export async function findDeviceContactPhoto(
  person: Person,
): Promise<string | null> {
  if (!(await hasContactsPermission())) return null;

  try {
    const linkedId = await AsyncStorage.getItem(linkKey(person.id));
    const contacts = await readDeviceContacts();
    const matchedId =
      linkedId && contacts.some((contact) => contact.id === linkedId)
        ? linkedId
        : findContactMatch(person, contacts)?.contact.id;
    if (!matchedId) return null;

    return await new Contact(matchedId).getImage();
  } catch {
    return null;
  }
}
