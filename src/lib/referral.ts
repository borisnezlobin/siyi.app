/**
 * Referral codes.
 *
 * A code gets read off one screen and typed into another, or said out loud in a
 * dining hall. That rules out the characters people confuse — I, L, O, 0 and 1
 * — and it rules out case sensitivity, since nobody remembers the case of a
 * code they heard.
 *
 * The mobile app keeps a parallel copy of this file. Change both.
 */

/** No I, L, O, 0 or 1. Everything here survives being handwritten. */
export const REFERRAL_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const REFERRAL_CODE_LENGTH = 7;

/**
 * 31^7 is about 27 billion, which is not a security property — the code is
 * public by design — but is enough that a generated code almost never collides
 * with an existing one on the first try.
 */
export function generateReferralCode(
  randomBytes: (count: number) => Uint8Array,
) {
  const bytes = randomBytes(REFERRAL_CODE_LENGTH);
  let code = "";
  for (let index = 0; index < REFERRAL_CODE_LENGTH; index += 1) {
    code += REFERRAL_ALPHABET[bytes[index] % REFERRAL_ALPHABET.length];
  }
  return code;
}

/**
 * What someone typed, turned into what is stored — or null if it could never be
 * a code. Lowercase is accepted, and so are the characters the alphabet leaves
 * out, because a person reading "JQ7MNP2" off a screen will sometimes type an
 * O for a Q or a 1 for a J. Mapping those to their lookalike is a better answer
 * than "invalid code".
 */
export function normalizeReferralCode(input: string | null | undefined) {
  if (!input) return null;

  const substitutions: Record<string, string> = {
    I: "J",
    L: "J",
    O: "Q",
    "0": "Q",
    "1": "J",
  };

  const cleaned = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .split("")
    .map((character) => substitutions[character] ?? character)
    .join("");

  if (cleaned.length !== REFERRAL_CODE_LENGTH) return null;
  if (!cleaned.split("").every((character) => REFERRAL_ALPHABET.includes(character))) {
    return null;
  }
  return cleaned;
}

export function referralUrl(baseUrl: string, code: string) {
  return `${baseUrl.replace(/\/$/, "")}/?ref=${code}`;
}

/**
 * The message a person actually sends. Written to be forwarded without editing,
 * which means it has to say what the thing is before it says where to get it.
 */
export function referralShareMessage(code: string, baseUrl: string) {
  return `I've been using Siyi to keep track of people I meet — it reminds you about birthdays and the friends you've gone quiet on. ${referralUrl(baseUrl, code)}`;
}

export type ReferralStanding = {
  code: string;
  joined: number;
};

/**
 * Ambassador standings, most-referred first. Ties break by code so the order is
 * stable between runs rather than dependent on however the rows came back.
 */
export function rankReferrers(
  rows: { code: string | null; joined: number }[],
): ReferralStanding[] {
  return rows
    .filter((row): row is ReferralStanding => Boolean(row.code))
    .sort((a, b) => b.joined - a.joined || a.code.localeCompare(b.code));
}
