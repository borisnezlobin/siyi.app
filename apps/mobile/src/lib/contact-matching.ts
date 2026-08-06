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
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    // Apostrophes and periods join a name rather than break it, so O'Neill and
    // ONeill are the same person, while a hyphen or comma separates words.
    .replace(/['\u2019.]/g, "")
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

/**
 * Phone is the only identifier strong enough to merge on by itself. A name
 * match alone is reported so the caller can decide, because two different
 * people genuinely do share a name.
 */
export function findContactMatch(
  person: Person,
  contacts: DeviceContact[],
): ContactMatch | null {
  const personPhone = normalizePhoneNumber(person.phoneNumber);
  if (personPhone) {
    const byPhone = contacts.find((contact) =>
      contact.phoneNumbers.some(
        (number) => normalizePhoneNumber(number) === personPhone,
      ),
    );
    if (byPhone) return { contact: byPhone, matchedOn: "phone" };
  }

  const personEmail = normalizeEmail(person.email);
  if (personEmail) {
    const byEmail = contacts.find((contact) =>
      contact.emails.some((email) => normalizeEmail(email) === personEmail),
    );
    if (byEmail) return { contact: byEmail, matchedOn: "email" };
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
  | { action: "none"; reason: "no-changes" | "ambiguous-name" };

export type ContactWriteFields = {
  name: string;
  phoneNumber?: string;
  email?: string;
};

export type ContactConflict = {
  field: "phoneNumber" | "email";
  existing: string;
  incoming: string;
};

/**
 * Only ever fills gaps on a contact the user already had. An existing value on
 * the device always wins — Siyi is not the authority on someone's phone book.
 */
export function planContactSync(
  person: Person,
  match: ContactMatch | null,
): ContactSyncPlan {
  const name = person.fullName.trim();
  const phoneNumber = person.phoneNumber?.trim() || undefined;
  const email = person.email?.trim() || undefined;

  if (!match) {
    return { action: "create", fields: { name, phoneNumber, email } };
  }

  const fields: ContactWriteFields = { name: match.contact.name };
  const skipped: ContactConflict[] = [];

  if (phoneNumber) {
    const incoming = normalizePhoneNumber(phoneNumber);
    const existing = match.contact.phoneNumbers
      .map((number) => normalizePhoneNumber(number))
      .filter(Boolean);
    if (existing.length === 0) {
      fields.phoneNumber = phoneNumber;
    } else if (incoming && !existing.includes(incoming)) {
      skipped.push({
        field: "phoneNumber",
        existing: match.contact.phoneNumbers[0],
        incoming: phoneNumber,
      });
    }
  }

  if (email) {
    const incoming = normalizeEmail(email);
    const existing = match.contact.emails
      .map((value) => normalizeEmail(value))
      .filter(Boolean);
    if (existing.length === 0) {
      fields.email = email;
    } else if (incoming && !existing.includes(incoming)) {
      skipped.push({
        field: "email",
        existing: match.contact.emails[0],
        incoming: email,
      });
    }
  }

  if (!fields.phoneNumber && !fields.email) {
    return { action: "none", reason: "no-changes" };
  }

  return { action: "update", contactId: match.contact.id, fields, skipped };
}
