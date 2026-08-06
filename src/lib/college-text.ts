/** Lowercase, unaccented, punctuation-free, single-spaced. Kept apart from the
 * college table so callers that only need to normalize text do not pull it in. */
export function normalizeCollegeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();
}
