/**
 * A share link publishes someone else's details to whoever holds the URL, and
 * that person never agreed to it. So the rules here are deliberately strict:
 * links expire unless the sharer opts out, and the payload is rebuilt from the
 * stored field selection rather than trimmed at render time.
 *
 * The token carries their surname so the link is readable, which does mean the
 * URL alone hints at who it is about. That is a deliberate trade for something
 * people will actually send; the details behind it still take a working link.
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


/**
 * A link gets texted, read aloud and typed, so it is six characters and nothing
 * else: siyi.app/s/k7f2mq. The alphabet drops the characters people confuse
 * when copying by hand — 0/O, 1/l/I — which leaves 56 and about 35 bits.
 *
 * Longer tokens were issued before, some with a surname in front, and those
 * keep working: the pattern accepts the whole range.
 */
export const shareTokenLength = 6;
export const shareTokenAlphabet =
  "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// The alphabet above, spelled as a range: the confusable characters (i, l, o,
// 0, 1) are absent, and the length is exact. The database check constraint is
// the same expression, so anything this accepts will insert.
export const shareTokenPattern = /^[a-hjkmnp-zA-HJ-NP-Z2-9]{6}$/;

/**
 * `randomBytes` must come from a cryptographically secure source. It is passed
 * in because Node and React Native disagree about where that lives.
 *
 * Bytes above the largest whole multiple of the alphabet are discarded rather
 * than folded in with a modulo, which would quietly bias the early characters.
 */
export function createShareToken(
  randomBytes: (size: number) => Uint8Array,
): string {
  const limit =
    Math.floor(256 / shareTokenAlphabet.length) * shareTokenAlphabet.length;
  let token = "";

  while (token.length < shareTokenLength) {
    const requested = shareTokenLength * 2;
    const bytes = randomBytes(requested);
    if (bytes.length < requested) {
      throw new Error("Share token needs a full draw of random bytes.");
    }
    for (const byte of bytes) {
      if (byte >= limit) continue;
      token += shareTokenAlphabet[byte % shareTokenAlphabet.length];
      if (token.length === shareTokenLength) break;
    }
  }

  return token;
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
    // Neither identifier is any use to a viewer, and both are ours rather than
    // the shared person's.
    id: "",
    userId: "",
    slug: null,
    profilePhotoUrl: null,
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
