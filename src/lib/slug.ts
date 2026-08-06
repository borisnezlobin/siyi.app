/**
 * Person URLs read as `/people/boris-nezlobin-7fk2`. The suffix is appended to
 * every slug, never only on collision: a slug that grows a suffix exactly when
 * someone else already owns that name would tell one account what another
 * account has stored.
 */

/** Digits and consonants only, so a suffix can never read as a word, and no
 * pair of characters is easy to confuse out loud (no 0/o, 1/l/i, 5/s). */
const suffixAlphabet = "23456789bcdfghjkmnpqrstvwxz";
const suffixLength = 4;
const maxNamePortionLength = 48;
const emptyNameFallback = "person";

const combiningMarks = /[\u0300-\u036f]/g;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function looksLikeUuid(value: string) {
  return uuidPattern.test(value);
}

export function isWellFormedSlug(value: string) {
  return value.length > 0 && value.length <= 80 && slugPattern.test(value);
}

/**
 * Rejection sampling rather than a modulo, so every character of the alphabet
 * is equally likely.
 */
export function randomSlugSuffix(length = suffixLength) {
  const largestWholeMultiple =
    256 - (256 % suffixAlphabet.length) - 1;
  let suffix = "";

  while (suffix.length < length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte > largestWholeMultiple) continue;
      suffix += suffixAlphabet[byte % suffixAlphabet.length];
      if (suffix.length === length) break;
    }
  }

  return suffix;
}

function truncateAtWordBoundary(value: string) {
  if (value.length <= maxNamePortionLength) return value;
  const clipped = value.slice(0, maxNamePortionLength);
  const lastBoundary = clipped.lastIndexOf("-");
  return lastBoundary > 0 ? clipped.slice(0, lastBoundary) : clipped;
}

/**
 * Accents are folded to their base letter; anything else outside `a-z0-9`
 * becomes a separator. Names written entirely in a non-Latin script leave
 * nothing behind, so they fall back to a readable word rather than a URL that
 * is only a random suffix.
 */
export function slugifyName(name: string) {
  const folded = name
    .normalize("NFKD")
    .replace(combiningMarks, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const truncated = truncateAtWordBoundary(folded).replace(/-+$/g, "");
  return truncated || emptyNameFallback;
}

export function personSlug(name: string) {
  return `${slugifyName(name)}-${randomSlugSuffix()}`;
}

/**
 * Falls back to the uuid so the app keeps linking correctly on a deploy that
 * has landed before migration 0012 was applied by hand.
 */
export function personPath(person: { id: string; slug?: string | null }) {
  return `/people/${person.slug || person.id}`;
}
