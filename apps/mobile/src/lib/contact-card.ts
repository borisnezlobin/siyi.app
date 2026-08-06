import { contactDraftsOf, contactValuesOfKind } from "@/lib/contact-methods";
import type { Person } from "@/lib/types";

export type ContactShareField =
  | "preferredName"
  | "phoneNumber"
  | "email"
  | "instagram"
  | "birthday"
  | "hometown"
  | "university"
  | "major"
  | "notes"
  | "bio";

export type ContactShareSelection = Record<ContactShareField, boolean>;

/**
 * Anything that identifies how to reach someone, or that they told you in
 * confidence, stays off until the person sharing turns it on deliberately.
 */
export const defaultContactShareSelection: ContactShareSelection = {
  preferredName: true,
  phoneNumber: false,
  email: false,
  instagram: true,
  birthday: false,
  hometown: true,
  university: true,
  major: true,
  notes: false,
  bio: false,
};

export const contactShareFieldLabels: Record<ContactShareField, string> = {
  preferredName: "Preferred name",
  phoneNumber: "Phone number",
  email: "Email address",
  instagram: "Instagram",
  birthday: "Birthday",
  hometown: "Hometown",
  university: "University",
  major: "Major",
  notes: "Your private notes",
  bio: "Short bio",
};

export function availableContactShareFields(person: Person) {
  const available: ContactShareField[] = [];
  if (person.preferredName) available.push("preferredName");
  if (person.phoneNumber) available.push("phoneNumber");
  if (person.email) available.push("email");
  if (person.instagramUsername) available.push("instagram");
  if (person.birthday) available.push("birthday");
  if (person.hometown) available.push("hometown");
  if (person.university) available.push("university");
  if (person.major) available.push("major");
  if (person.generalNotes) available.push("notes");
  return available;
}

function escapeValue(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/** vCard lines are limited to 75 octets, continued with a leading space. */
function foldLine(line: string) {
  if (line.length <= 75) return line;
  const segments = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    segments.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest.length > 0) segments.push(` ${rest}`);
  return segments.join("\r\n");
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return { given: fullName.trim(), family: "" };
  return { given: parts.slice(0, -1).join(" "), family: parts[parts.length - 1] };
}

export type BuildVCardOptions = {
  /** A generated summary, included only when the `bio` field is selected. */
  bio?: string | null;
};

export function buildVCard(
  person: Person,
  selection: ContactShareSelection,
  options: BuildVCardOptions = {},
) {
  const { given, family } = splitName(person.fullName);
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${escapeValue(family)};${escapeValue(given)};;;`,
    `FN:${escapeValue(person.fullName)}`,
  ];

  if (selection.preferredName && person.preferredName) {
    lines.push(`NICKNAME:${escapeValue(person.preferredName)}`);
  }
  // vCard 3.0 repeats TEL and EMAIL freely, so someone with three numbers
  // arrives in the other person's address book with all three, primary marked
  // PREF. Sharing is still all-or-nothing per kind, as the picker promises.
  const contactMethods = contactDraftsOf(person);

  if (selection.phoneNumber) {
    for (const phone of contactValuesOfKind(contactMethods, "phone")) {
      const types = phone.isPrimary ? "CELL,PREF" : "CELL";
      lines.push(`TEL;TYPE=${types}:${escapeValue(phone.value)}`);
    }
  }
  if (selection.email) {
    for (const email of contactValuesOfKind(contactMethods, "email")) {
      const types = email.isPrimary ? "INTERNET,PREF" : "INTERNET";
      lines.push(`EMAIL;TYPE=${types}:${escapeValue(email.value)}`);
    }
  }
  if (selection.instagram) {
    for (const handle of contactValuesOfKind(contactMethods, "instagram")) {
      lines.push(
        `X-SOCIALPROFILE;TYPE=instagram:https://instagram.com/${escapeValue(
          handle.value,
        )}`,
      );
    }
  }
  if (selection.birthday && person.birthday) {
    lines.push(`BDAY:${escapeValue(person.birthday)}`);
  }
  if (selection.university && person.university) {
    lines.push(`ORG:${escapeValue(person.university)}`);
  }
  if (selection.major && person.major) {
    lines.push(`TITLE:${escapeValue(person.major)}`);
  }
  if (selection.hometown && person.hometown) {
    lines.push(`ADR;TYPE=HOME:;;;${escapeValue(person.hometown)};;;`);
  }

  const noteParts: string[] = [];
  if (selection.bio && options.bio) noteParts.push(options.bio.trim());
  if (selection.notes && person.generalNotes) {
    noteParts.push(person.generalNotes.trim());
  }
  if (noteParts.length > 0) {
    lines.push(`NOTE:${escapeValue(noteParts.join("\n\n"))}`);
  }

  lines.push("END:VCARD");
  return lines.map(foldLine).join("\r\n");
}

export function contactCardFileName(person: Person) {
  const safeName = person.fullName
    .trim()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${safeName || "contact"}.vcf`;
}
