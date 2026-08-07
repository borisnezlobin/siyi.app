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
