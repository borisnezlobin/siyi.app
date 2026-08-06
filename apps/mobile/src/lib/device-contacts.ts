import AsyncStorage from "@react-native-async-storage/async-storage";
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

export async function hasContactsPermission() {
  return (await getPermissionsAsync()).granted;
}

export async function requestContactsPermission() {
  await markContactsPrompted();
  return (await requestPermissionsAsync()).granted;
}

const readFields = [
  ContactField.FULL_NAME,
  ContactField.GIVEN_NAME,
  ContactField.FAMILY_NAME,
  ContactField.PHONES,
  ContactField.EMAILS,
] as const;

async function readDeviceContacts(): Promise<DeviceContact[]> {
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
  | { status: "created"; contactId: string }
  | { status: "updated"; contactId: string; skipped: ContactConflict[] }
  | { status: "unchanged" }
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
    const contacts = await readDeviceContacts();
    const linkedId = await AsyncStorage.getItem(linkKey(person.id));
    const linked = linkedId
      ? contacts.find((contact) => contact.id === linkedId)
      : undefined;
    const match = linked
      ? ({ contact: linked, matchedOn: "phone" } as const)
      : findContactMatch(person, contacts);
    const plan = planContactSync(person, match);

    if (plan.action === "none") return { status: "unchanged" };

    if (plan.action === "create") {
      const { givenName, familyName } = splitName(plan.fields.name);
      const created = await Contact.create({
        givenName,
        familyName,
        ...(plan.fields.phoneNumber
          ? { phones: [{ label: "mobile", number: plan.fields.phoneNumber }] }
          : {}),
        ...(plan.fields.email
          ? { emails: [{ label: "home", address: plan.fields.email }] }
          : {}),
      });
      await AsyncStorage.setItem(linkKey(person.id), created.id);
      return { status: "created", contactId: created.id };
    }

    const target = (await Contact.getAll()).find(
      (contact) => contact.id === plan.contactId,
    );
    if (!target) {
      return { status: "failed", message: "That contact is no longer on this device." };
    }

    if (plan.fields.phoneNumber) {
      await target.addPhone({ label: "mobile", number: plan.fields.phoneNumber });
    }
    if (plan.fields.email) {
      await target.addEmail({ label: "home", address: plan.fields.email });
    }

    await AsyncStorage.setItem(linkKey(person.id), plan.contactId);
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

export async function forgetContactLink(personId: string) {
  await AsyncStorage.removeItem(linkKey(personId));
}
