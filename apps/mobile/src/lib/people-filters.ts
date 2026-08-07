import { normalizeCollegeText } from "@/lib/college-text";
import { plainCollegeTerms, type CollegeTermsLookup } from "@/lib/college-terms";

type ContactMethodish = { kind: string; value: string | null } | undefined;

export type FilterablePerson = {
  fullName: string;
  preferredName?: string | null;
  instagramUsername?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  contactMethods?: ContactMethodish[];
  birthday?: string | null;
  university?: string | null;
  major?: string | null;
  dormOrResidence?: string | null;
  hometown?: string | null;
  generalNotes?: string | null;
  tags?: { name: string }[];
};

export type MissingDetail = "birthday" | "email" | "phone";

/** How new "Added recently" means, on both platforms. */
export const recentlyAddedWithinDays = 30;

export function wasAddedRecently(createdAt: string, now: Date = new Date()): boolean {
  const addedAt = new Date(createdAt).getTime();
  return now.getTime() - addedAt <= recentlyAddedWithinDays * 86_400_000;
}

export const missingDetailLabels: Record<MissingDetail, string> = {
  birthday: "No birthday",
  email: "No email",
  phone: "No phone",
};

function hasContactOfKind(person: FilterablePerson, kind: "email" | "phone"): boolean {
  const column = kind === "email" ? person.email : person.phoneNumber;
  if (column && column.trim()) return true;
  return (person.contactMethods ?? []).some(
    (method) => method?.kind === kind && !!method.value && method.value.trim().length > 0
  );
}

export function isMissingDetail(person: FilterablePerson, detail: MissingDetail): boolean {
  if (detail === "birthday") return !person.birthday;
  return !hasContactOfKind(person, detail);
}

export function missingDetailsOf(person: FilterablePerson): MissingDetail[] {
  return (["birthday", "email", "phone"] as const).filter((detail) =>
    isMissingDetail(person, detail)
  );
}

export function displayNameOf(person: FilterablePerson): string {
  return person.preferredName?.trim() || person.fullName;
}

/**
 * Matches the query against everything recorded about someone, plus every name
 * their school goes by — so "CMU" finds the person filed under Carnegie Mellon.
 */
export function matchesPeopleQuery(
  person: FilterablePerson,
  rawQuery: string,
  collegeTerms: CollegeTermsLookup = plainCollegeTerms
): boolean {
  const query = normalizeCollegeText(rawQuery);
  if (!query) return true;

  const haystack = [
    person.fullName,
    person.preferredName,
    person.instagramUsername,
    person.phoneNumber,
    person.email,
    person.generalNotes,
    person.university,
    person.major,
    person.dormOrResidence,
    person.hometown,
    ...(person.tags ?? []).map((tag) => tag.name),
    ...(person.contactMethods ?? []).map((method) => method?.value ?? ""),
  ]
    .filter(Boolean)
    .map((value) => normalizeCollegeText(String(value)))
    .join(" ");

  if (haystack.includes(query)) return true;
  if (!person.university) return false;
  return collegeTerms(person.university).some((term) => term.includes(query));
}

export type PeopleSection<T> = {
  letter: string;
  people: T[];
};

function sectionLetterFor(person: FilterablePerson): string {
  const first = displayNameOf(person).trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}

/**
 * Groups people under the initial of the name they are shown by, with anything
 * that does not start with a letter collected under "#" at the end.
 */
export function sectionPeopleAlphabetically<T extends FilterablePerson>(
  people: T[]
): PeopleSection<T>[] {
  const sections = new Map<string, T[]>();
  for (const person of people) {
    const letter = sectionLetterFor(person);
    const bucket = sections.get(letter);
    if (bucket) bucket.push(person);
    else sections.set(letter, [person]);
  }

  for (const bucket of sections.values()) {
    bucket.sort((left, right) =>
      displayNameOf(left).localeCompare(displayNameOf(right), undefined, {
        sensitivity: "base",
      })
    );
  }

  return [...sections.entries()]
    .sort(([left], [right]) => {
      if (left === "#") return 1;
      if (right === "#") return -1;
      return left.localeCompare(right);
    })
    .map(([letter, bucket]) => ({ letter, people: bucket }));
}
