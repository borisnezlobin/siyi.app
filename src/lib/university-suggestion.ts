import { collegeForEmail, emailDomain } from "@/lib/colleges";

/**
 * Recognising somebody's school from the address they signed up with.
 *
 * Two rules, and the second is the one that matters. It offers, and it never
 * overwrites: a field somebody has already answered is left alone, so this can
 * only ever fill a blank. And it says where the answer came from, because a
 * field that quietly fills itself is worse than one you typed.
 */
export type UniversitySuggestion = {
  /** The school's full name, ready to accept. */
  name: string;
  /** The address it was read from, for the note that explains it. */
  domain: string;
};

export function suggestUniversityFromEmail(
  email: string | null | undefined,
  currentValue: string | null | undefined,
): UniversitySuggestion | null {
  // Anything already there is an answer, not a gap to fill.
  if ((currentValue ?? "").trim()) return null;

  const college = collegeForEmail(email);
  if (!college) return null;

  return { name: college.name, domain: emailDomain(email) };
}

/** The same sentence on both platforms. */
export function universitySuggestionNote(domain: string) {
  return `From your ${domain} address`;
}
