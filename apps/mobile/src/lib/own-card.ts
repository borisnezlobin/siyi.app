/**
 * The details you hand out about yourself.
 *
 * Everyone you meet asks for some subset of the same things, and typing them
 * again each time is the friction this removes. It stays off until it is turned
 * on, and offers rather than fills: adding somebody never quietly writes your
 * details onto their profile without you saying so.
 */

export const ownCardFields = [
  "fullName",
  "preferredName",
  "phoneNumber",
  "email",
  "instagramUsername",
  "discordUsername",
  "birthday",
  "hometown",
  "university",
  "major",
  "graduationYear",
  "dormOrResidence",
] as const;

export type OwnCardField = (typeof ownCardFields)[number];
export type OwnCard = Partial<Record<OwnCardField, string>>;

export const ownCardLabels: Record<OwnCardField, string> = {
  fullName: "Full name",
  preferredName: "Goes by",
  phoneNumber: "Phone",
  email: "Email",
  instagramUsername: "Instagram",
  discordUsername: "Discord",
  birthday: "Birthday",
  hometown: "Hometown",
  university: "University",
  major: "Major",
  graduationYear: "Graduation year",
  dormOrResidence: "Dorm or residence",
};

/**
 * What kind of entry each field wants. Both apps read this rather than deciding
 * for themselves, which is what keeps a university field an autocomplete and a
 * birthday a real date entry on the phone and on the web alike.
 */
export type OwnCardFieldKind =
  | "text"
  | "email"
  | "phone"
  | "date"
  | "number"
  | "university";

export const ownCardFieldKinds: Record<OwnCardField, OwnCardFieldKind> = {
  fullName: "text",
  preferredName: "text",
  phoneNumber: "phone",
  email: "email",
  instagramUsername: "text",
  discordUsername: "text",
  birthday: "date",
  hometown: "text",
  university: "university",
  major: "text",
  graduationYear: "number",
  dormOrResidence: "text",
};

/** Neutral examples, so nobody's own details end up shipped as placeholder text. */
export const ownCardPlaceholders: Partial<Record<OwnCardField, string>> = {
  fullName: "Alex Vale",
  preferredName: "Alex",
  phoneNumber: "(555) 555-0123",
  email: "alex@example.edu",
  instagramUsername: "@username",
  discordUsername: "username",
  hometown: "Springfield, Illinois",
  major: "Computer Science",
  graduationYear: "2027",
  dormOrResidence: "Unit 2",
};

/**
 * Whether a field is on the card a stranger sees.
 *
 * Three states, not two: a field you have not filled in cannot be shared at all,
 * and saying so is more use than a switch that silently does nothing.
 */
export type OwnCardShareState = "unavailable" | "hidden" | "shared";

export function ownCardShareState(
  card: OwnCard,
  publicFields: Record<string, boolean>,
  field: OwnCardField,
): OwnCardShareState {
  if (!card[field]) return "unavailable";
  return publicFields[field] === true ? "shared" : "hidden";
}

/**
 * Said out loud after the field name, so the three states are distinguishable
 * without seeing the strikethrough or the fill.
 */
export const ownCardShareStateLabels: Record<OwnCardShareState, string> = {
  unavailable: "nothing to share yet",
  hidden: "not shared",
  shared: "shared",
};

/**
 * A row written by an older client, or one that has been tampered with, becomes
 * an empty card rather than something unexpected downstream.
 */
export function normalizeOwnCard(value: unknown): OwnCard {
  const source =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  const card: OwnCard = {};
  for (const field of ownCardFields) {
    const entry = source[field];
    if (typeof entry === "string" && entry.trim()) card[field] = entry.trim();
  }
  return card;
}

export function ownCardIsEmpty(card: OwnCard) {
  return ownCardFields.every((field) => !card[field]);
}

export function filledOwnCardFields(card: OwnCard) {
  return ownCardFields.filter((field) => Boolean(card[field]));
}

/** A short summary for the settings row: "Phone, Email and 3 more". */
export function ownCardSummary(card: OwnCard) {
  const filled = filledOwnCardFields(card);
  if (filled.length === 0) return "Nothing saved yet";
  const named = filled.slice(0, 2).map((field) => ownCardLabels[field]);
  const rest = filled.length - named.length;
  if (rest === 0) return named.join(" and ");
  return `${named.join(", ")} and ${rest} more`;
}
