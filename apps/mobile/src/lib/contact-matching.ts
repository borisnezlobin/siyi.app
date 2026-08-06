import {
  contactDraftsOf,
  contactValuesOfKind,
  type ContactMethodDraft,
} from "@/lib/contact-methods";
import type { Person } from "@/lib/types";

export type DeviceContact = {
  id: string;
  name: string;
  phoneNumbers: string[];
  emails: string[];
};

/**
 * Digits only, compared on the trailing ten so that a number saved as
 * +1 (415) 555-0134 still matches one saved as 4155550134.
 */
export function normalizePhoneNumber(value: string | null | undefined) {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizePersonName(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Apostrophes and periods join a name rather than break it, so O'Neill and
    // ONeill are the same person, while a hyphen or comma separates words.
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return normalized || null;
}

export function normalizeEmail(value: string | null | undefined) {
  if (!value) return null;
  return value.trim().toLowerCase() || null;
}

export type ContactMatch = {
  contact: DeviceContact;
  matchedOn: "phone" | "email" | "name";
};

function uniqueValues(values: (string | null)[]) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function personPhones(person: Person) {
  return uniqueValues(
    contactValuesOfKind(contactDraftsOf(person), "phone").map((draft) =>
      normalizePhoneNumber(draft.value),
    ),
  );
}

function personEmails(person: Person) {
  return uniqueValues(
    contactValuesOfKind(contactDraftsOf(person), "email").map((draft) =>
      normalizeEmail(draft.value),
    ),
  );
}

/**
 * Phone is the only identifier strong enough to merge on by itself, and every
 * number this person has counts — an old number still on the device is still
 * them. Two different device contacts holding two of their numbers is
 * ambiguous, though, so that is reported as no match rather than guessed at,
 * exactly as a shared name always has been.
 */
export function findContactMatch(
  person: Person,
  contacts: DeviceContact[],
): ContactMatch | null {
  const phones = personPhones(person);
  if (phones.length > 0) {
    const byPhone = contacts.filter((contact) =>
      contact.phoneNumbers.some((number) => {
        const normalized = normalizePhoneNumber(number);
        return normalized !== null && phones.includes(normalized);
      }),
    );
    if (byPhone.length === 1) return { contact: byPhone[0], matchedOn: "phone" };
    if (byPhone.length > 1) return null;
  }

  const emails = personEmails(person);
  if (emails.length > 0) {
    const byEmail = contacts.filter((contact) =>
      contact.emails.some((email) => {
        const normalized = normalizeEmail(email);
        return normalized !== null && emails.includes(normalized);
      }),
    );
    if (byEmail.length === 1) return { contact: byEmail[0], matchedOn: "email" };
    if (byEmail.length > 1) return null;
  }

  const personName = normalizePersonName(person.fullName);
  if (personName) {
    const named = contacts.filter(
      (contact) => normalizePersonName(contact.name) === personName,
    );
    // Ambiguous by name is the same as no match — never guess between two people.
    if (named.length === 1) return { contact: named[0], matchedOn: "name" };
  }

  return null;
}

export type ContactSyncPlan =
  | { action: "create"; fields: ContactWriteFields }
  | {
      action: "update";
      contactId: string;
      fields: ContactWriteFields;
      skipped: ContactConflict[];
    }
  | {
      action: "none";
      reason: "no-changes" | "ambiguous-name";
      skipped: ContactConflict[];
    };

export type ContactWriteFields = {
  name: string;
  /** The first of `phoneNumbers`, kept so nothing that only ever expected one
   * value has to change. */
  phoneNumber?: string;
  email?: string;
  /** Everything to write, primary first. */
  phoneNumbers?: string[];
  emails?: string[];
};

export type ContactConflict = {
  field: "phoneNumber" | "email";
  existing: string;
  incoming: string;
};

function valuesToAdd(
  drafts: ContactMethodDraft[],
  kind: "phone" | "email",
  onDevice: string[],
) {
  const normalize = kind === "phone" ? normalizePhoneNumber : normalizeEmail;
  const existing = uniqueValues(onDevice.map((value) => normalize(value)));
  const added: string[] = [];
  const seen = new Set(existing);

  for (const draft of contactValuesOfKind(drafts, kind)) {
    const value = draft.value.trim();
    const normalized = normalize(value);
    if (!value || !normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    added.push(value);
  }

  return { existing, added };
}

/**
 * Only ever fills gaps on a contact the user already had. A value already on
 * the device is never touched or replaced — Siyi is not the authority on
 * someone's phone book — but numbers and addresses the device has never seen
 * are worth offering, however many there are.
 */
export function planContactSync(
  person: Person,
  match: ContactMatch | null,
): ContactSyncPlan {
  const name = person.fullName.trim();
  const drafts = contactDraftsOf(person);
  const allPhones = contactValuesOfKind(drafts, "phone").map((draft) =>
    draft.value.trim(),
  );
  const allEmails = contactValuesOfKind(drafts, "email").map((draft) =>
    draft.value.trim(),
  );

  if (!match) {
    return {
      action: "create",
      fields: {
        name,
        ...(allPhones.length
          ? { phoneNumber: allPhones[0], phoneNumbers: allPhones }
          : {}),
        ...(allEmails.length
          ? { email: allEmails[0], emails: allEmails }
          : {}),
      },
    };
  }

  const fields: ContactWriteFields = { name: match.contact.name };
  const skipped: ContactConflict[] = [];

  const phones = valuesToAdd(drafts, "phone", match.contact.phoneNumbers);
  if (phones.added.length > 0) {
    if (phones.existing.length === 0) {
      [fields.phoneNumber] = phones.added;
      fields.phoneNumbers = phones.added;
    } else {
      // The device already has a number for them; anything different is
      // reported rather than written over what they chose to keep.
      for (const incoming of phones.added) {
        skipped.push({
          field: "phoneNumber",
          existing: match.contact.phoneNumbers[0],
          incoming,
        });
      }
    }
  }

  const emails = valuesToAdd(drafts, "email", match.contact.emails);
  if (emails.added.length > 0) {
    if (emails.existing.length === 0) {
      [fields.email] = emails.added;
      fields.emails = emails.added;
    } else {
      for (const incoming of emails.added) {
        skipped.push({
          field: "email",
          existing: match.contact.emails[0],
          incoming,
        });
      }
    }
  }

  if (!fields.phoneNumber && !fields.email) {
    // Nothing gets written, but a clash the user should hear about is still a
    // clash — it travels with the plan rather than being dropped here.
    return { action: "none", reason: "no-changes", skipped };
  }

  return { action: "update", contactId: match.contact.id, fields, skipped };
}
