/**
 * A share link publishes someone else's details to whoever holds the URL, and
 * that person never agreed to it. So the rules here are deliberately strict:
 * the token carries all the entropy (nothing about it is derived from the
 * person), links expire unless the sharer opts out, and the payload is rebuilt
 * from the stored field selection rather than trimmed at render time.
 */

import {
  contactDraftsOf,
  type ContactMethodDraft,
} from "@/lib/contact-methods";
import {
  defaultContactShareSelection,
  type ContactShareField,
  type ContactShareSelection,
} from "@/lib/contact-card";
import type { Person } from "@/lib/types";

const base64UrlAlphabet =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** 24 bytes is 192 bits, and divides by three so base64url needs no padding. */
export const shareTokenByteLength = 24;
export const shareTokenLength = 32;
export const shareTokenPattern = /^[A-Za-z0-9_-]{32}$/;

function encodeBase64Url(bytes: Uint8Array) {
  let encoded = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const chunk =
      (bytes[index] << 16) |
      ((bytes[index + 1] ?? 0) << 8) |
      (bytes[index + 2] ?? 0);
    const characters = [
      base64UrlAlphabet[(chunk >> 18) & 63],
      base64UrlAlphabet[(chunk >> 12) & 63],
      base64UrlAlphabet[(chunk >> 6) & 63],
      base64UrlAlphabet[chunk & 63],
    ];
    const remaining = bytes.length - index;
    encoded += characters.slice(0, remaining >= 3 ? 4 : remaining + 1).join("");
  }
  return encoded;
}

/**
 * `randomBytes` must come from a cryptographically secure source. It is passed
 * in because Node and React Native disagree about where that lives.
 */
export function createShareToken(
  randomBytes: (size: number) => Uint8Array,
): string {
  const bytes = randomBytes(shareTokenByteLength);
  if (bytes.length !== shareTokenByteLength) {
    throw new Error("Share token needs 24 random bytes.");
  }
  return encodeBase64Url(bytes);
}

export function isValidShareToken(value: unknown): value is string {
  return typeof value === "string" && shareTokenPattern.test(value);
}

export const shareExpiryChoices = [
  { id: "1d", label: "24 hours", days: 1 },
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "never", label: "No expiry", days: null },
] as const;

export type ShareExpiryChoiceId = (typeof shareExpiryChoices)[number]["id"];

export const defaultShareExpiryChoiceId: ShareExpiryChoiceId = "30d";

export function isShareExpiryChoiceId(
  value: unknown,
): value is ShareExpiryChoiceId {
  return shareExpiryChoices.some((choice) => choice.id === value);
}

/**
 * Anything unrecognised falls back to the 30 day default rather than to "never",
 * so a bad client can never mint a permanent link by accident.
 */
export function shareExpiryFromChoice(
  choiceId: unknown,
  now: Date = new Date(),
): string | null {
  const choice = shareExpiryChoices.find((entry) => entry.id === choiceId);
  const days =
    choice?.id === "never"
      ? null
      : (choice?.days ??
        shareExpiryChoices.find(
          (entry) => entry.id === defaultShareExpiryChoiceId,
        )!.days);

  if (days === null) return null;
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

export type PersonShare = {
  id: string;
  personId: string;
  token: string;
  selection: ContactShareSelection;
  expiresAt: string | null;
  revokedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  createdAt: string;
};

const shareFields = Object.keys(
  defaultContactShareSelection,
) as ContactShareField[];

/**
 * Every field starts off. A row written by an older client, or one that has
 * been tampered with, therefore exposes nothing rather than everything.
 */
export function normalizeShareSelection(value: unknown): ContactShareSelection {
  const source =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return shareFields.reduce((selection, field) => {
    selection[field] = source[field] === true;
    return selection;
  }, {} as ContactShareSelection);
}

type PersonShareRow = {
  id: string;
  person_id: string;
  token: string;
  fields: unknown;
  expires_at: string | null;
  revoked_at: string | null;
  last_viewed_at: string | null;
  view_count: number | null;
  created_at: string;
};

export function mapPersonShare(row: PersonShareRow): PersonShare {
  return {
    id: row.id,
    personId: row.person_id,
    token: row.token,
    selection: normalizeShareSelection(row.fields),
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    lastViewedAt: row.last_viewed_at,
    viewCount: row.view_count ?? 0,
    createdAt: row.created_at,
  };
}

export function shareIsLive(
  share: Pick<PersonShare, "expiresAt" | "revokedAt">,
  now: Date = new Date(),
) {
  if (share.revokedAt) return false;
  if (!share.expiresAt) return true;
  return Date.parse(share.expiresAt) > now.getTime();
}

export function sharePath(token: string) {
  return `/s/${token}`;
}

export function buildShareUrl(baseUrl: string, token: string) {
  return `${baseUrl.replace(/\/+$/, "")}${sharePath(token)}`;
}

/** The share tables only exist once migration 0015 has been applied. */
export function isMissingPersonSharesSchema(code: string | undefined) {
  return ["42P01", "42883", "42703", "PGRST202", "PGRST204", "PGRST205"].includes(
    code || "",
  );
}

function selectedContactKinds(selection: ContactShareSelection) {
  const kinds: ContactMethodDraft["kind"][] = [];
  if (selection.phoneNumber) kinds.push("phone");
  if (selection.email) kinds.push("email");
  if (selection.instagram) kinds.push("instagram");
  return kinds;
}

/**
 * The person as the link is allowed to show them. Everything the sharer did not
 * tick is removed here, at the source, so no renderer downstream has to
 * remember to leave it out.
 */
export function redactedSharePerson(
  person: Person,
  selection: ContactShareSelection,
): Person {
  const kinds = selectedContactKinds(selection);
  const contactMethods = contactDraftsOf(person).filter((method) =>
    kinds.includes(method.kind),
  );

  return {
    ...person,
    userId: "",
    slug: null,
    profilePhotoUrl: null,
    profilePhotoPath: null,
    dormOrResidence: null,
    graduationYear: null,
    firstMetLocation: null,
    relationshipLabel: null,
    reminderIntervalDays: null,
    lastInteractionAt: null,
    tags: [],
    preferredName: selection.preferredName ? person.preferredName : null,
    phoneNumber: selection.phoneNumber ? person.phoneNumber : null,
    email: selection.email ? person.email : null,
    instagramUsername: selection.instagram ? person.instagramUsername : null,
    birthday: selection.birthday ? person.birthday : null,
    hometown: selection.hometown ? person.hometown : null,
    university: selection.university ? person.university : null,
    major: selection.major ? person.major : null,
    generalNotes: selection.notes ? person.generalNotes : null,
    contactMethods,
  };
}

/** The fields a viewer will actually see, in the order the page lists them. */
export function sharedFieldRows(
  person: Person,
  selection: ContactShareSelection,
  bio?: string | null,
) {
  const rows: { field: ContactShareField; label: string; value: string }[] = [];
  const add = (field: ContactShareField, label: string, value: unknown) => {
    if (!selection[field]) return;
    if (typeof value !== "string" || !value.trim()) return;
    rows.push({ field, label, value: value.trim() });
  };

  add("preferredName", "Goes by", person.preferredName);
  for (const method of contactDraftsOf(person)) {
    if (method.kind === "phone" && selection.phoneNumber) {
      rows.push({ field: "phoneNumber", label: "Phone", value: method.value });
    }
    if (method.kind === "email" && selection.email) {
      rows.push({ field: "email", label: "Email", value: method.value });
    }
    if (method.kind === "instagram" && selection.instagram) {
      rows.push({
        field: "instagram",
        label: "Instagram",
        value: `@${method.value}`,
      });
    }
  }
  add("birthday", "Birthday", person.birthday);
  add("hometown", "Hometown", person.hometown);
  add("university", "University", person.university);
  add("major", "Studying", person.major);
  add("bio", "About", bio);
  add("notes", "Notes", person.generalNotes);

  return rows;
}
