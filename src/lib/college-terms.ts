import { normalizeCollegeText } from "@/lib/college-text";

/**
 * Extra strings a stored university should match, supplied by the caller.
 *
 * People search runs on every keystroke on a page that would otherwise ship the
 * whole college table to the browser for it. Keeping the lookup behind this
 * indirection lets the directory load the table only once someone actually
 * searches, and match plain text in the meantime.
 */
export type CollegeTermsLookup = (university: string) => string[];

export const plainCollegeTerms: CollegeTermsLookup = (university) => [
  normalizeCollegeText(university),
];
