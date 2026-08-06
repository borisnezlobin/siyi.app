import { ageAtNextBirthday, birthdayDate } from "@/lib/birthday-age";

export type BirthdayPerson = {
  id: string;
  fullName: string;
  preferredName?: string | null;
  birthday?: string | null;
};

export type BirthdayEntry<T extends BirthdayPerson = BirthdayPerson> = {
  person: T;
  month: number;
  day: number;
  /** Days from today until the next time it comes round; 0 means today. */
  daysAway: number;
  turningAge: number | null;
};

export type BirthdayMonth<T extends BirthdayPerson = BirthdayPerson> = {
  month: number;
  label: string;
  entries: BirthdayEntry<T>[];
};

export const monthLabels = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const dayInMilliseconds = 86_400_000;

function atMidday(year: number, month: number, day: number) {
  return new Date(year, month, day, 12, 0, 0, 0);
}

/**
 * How many days until this birthday next comes round, counting today as 0.
 *
 * A 29 February birthday falls back to 1 March in common years, which is the
 * day most people celebrate it and, more importantly, keeps it from silently
 * vanishing for three years at a time.
 */
export function nextBirthdayDate(birthday: string | null | undefined, today = new Date()) {
  const born = birthdayDate(birthday);
  if (!born) return null;

  const from = atMidday(today.getFullYear(), today.getMonth(), today.getDate());
  for (const year of [from.getFullYear(), from.getFullYear() + 1]) {
    const candidate = atMidday(year, born.getMonth(), born.getDate());
    if (candidate.getTime() >= from.getTime()) return candidate;
  }
  return null;
}

export function daysUntilBirthday(birthday: string | null | undefined, today = new Date()) {
  const next = nextBirthdayDate(birthday, today);
  if (!next) return null;
  const from = atMidday(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((next.getTime() - from.getTime()) / dayInMilliseconds);
}

export function birthdayEntriesOf<T extends BirthdayPerson>(
  people: T[],
  today = new Date()
): BirthdayEntry<T>[] {
  const entries: BirthdayEntry<T>[] = [];
  for (const person of people) {
    const born = birthdayDate(person.birthday);
    const daysAway = daysUntilBirthday(person.birthday, today);
    if (!born || daysAway === null) continue;
    entries.push({
      person,
      month: born.getMonth(),
      day: born.getDate(),
      daysAway,
      turningAge: ageAtNextBirthday(person.birthday, today),
    });
  }
  return entries;
}

/** Every birthday in calendar order, January first, for a year-at-a-glance view. */
export function birthdaysByMonth<T extends BirthdayPerson>(
  people: T[],
  today = new Date()
): BirthdayMonth<T>[] {
  const entries = birthdayEntriesOf(people, today);
  return monthLabels.map((label, month) => ({
    month,
    label,
    entries: entries
      .filter((entry) => entry.month === month)
      .sort((left, right) => left.day - right.day || nameOf(left).localeCompare(nameOf(right))),
  }));
}

/** The next birthdays coming up, soonest first — what the Today screen wants. */
export function upcomingBirthdays<T extends BirthdayPerson>(
  people: T[],
  today = new Date(),
  withinDays = 60
): BirthdayEntry<T>[] {
  return birthdayEntriesOf(people, today)
    .filter((entry) => entry.daysAway <= withinDays)
    .sort((left, right) => left.daysAway - right.daysAway || nameOf(left).localeCompare(nameOf(right)));
}

function nameOf(entry: BirthdayEntry<BirthdayPerson>) {
  return entry.person.preferredName?.trim() || entry.person.fullName;
}

export function birthdayCountdownLabel(daysAway: number) {
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  if (daysAway < 7) return `In ${daysAway} days`;
  if (daysAway < 14) return "Next week";
  return `In ${Math.round(daysAway / 7)} weeks`;
}
