/**
 * The classes somebody is taking.
 *
 * No university exposes a course API that works across institutions — schools
 * run Banner, PeopleSoft, Workday or Jenzabar, each a separate install behind
 * its own auth — so these are typed in rather than imported. The upside is that
 * it works at every school immediately, and the list you have already entered
 * autocompletes, so the fifth person in a course is one tap.
 */

export type PersonClass = {
  id: string;
  personId: string;
  courseCode: string;
  courseTitle: string | null;
  professor: string | null;
  term: string | null;
  /** Single-letter days: "MWF", "TuTh". */
  days: string | null;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
};

export const weekdays = [
  { key: "M", label: "Mon" },
  { key: "Tu", label: "Tue" },
  { key: "W", label: "Wed" },
  { key: "Th", label: "Thu" },
  { key: "F", label: "Fri" },
  { key: "Sa", label: "Sat" },
  { key: "Su", label: "Sun" },
] as const;

export type WeekdayKey = (typeof weekdays)[number]["key"];

/**
 * "TuTh" is two days, not four. Parsed longest-first so the two-letter days are
 * taken before the single letters that start them.
 */
export function parseDays(days: string | null | undefined): WeekdayKey[] {
  if (!days) return [];
  const found: WeekdayKey[] = [];
  let rest = days.replace(/[^A-Za-z]/g, "");

  while (rest.length > 0) {
    const match = (["Tu", "Th", "Sa", "Su", "M", "W", "F"] as const).find((key) =>
      rest.toLowerCase().startsWith(key.toLowerCase()),
    );
    if (!match) {
      rest = rest.slice(1);
      continue;
    }
    if (!found.includes(match)) found.push(match);
    rest = rest.slice(match.length);
  }

  return weekdays.map(({ key }) => key).filter((key) => found.includes(key));
}

export function formatDays(days: WeekdayKey[]): string {
  return weekdays
    .map(({ key }) => key)
    .filter((key) => days.includes(key))
    .join("");
}

export function normalizeCourseCode(value: string): string {
  // "cs 61a", "CS61A" and "cs-61a" are one course.
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Matches a class against a search. "data 8" finds DATA 8, "denero" finds
 * whoever teaches it, and "data 8 denero" needs both — so a query can name a
 * course and its professor together.
 */
export function classMatchesQuery(entry: PersonClass, rawQuery: string): boolean {
  const query = normalizeText(rawQuery);
  if (!query) return true;

  const haystack = normalizeText(
    [entry.courseCode, entry.courseTitle, entry.professor, entry.term]
      .filter(Boolean)
      .join(" "),
  );

  return query.split(" ").every((word) => haystack.includes(word));
}

export function personMatchesClassQuery(
  classes: PersonClass[],
  rawQuery: string,
): boolean {
  return classes.some((entry) => classMatchesQuery(entry, rawQuery));
}

/** Distinct courses across everyone, for the autocomplete and the filter list. */
export function courseOptions(classes: PersonClass[]) {
  const byCode = new Map<string, { code: string; title: string | null; count: number }>();

  for (const entry of classes) {
    const code = normalizeCourseCode(entry.courseCode);
    const existing = byCode.get(code);
    if (existing) {
      existing.count += 1;
      existing.title = existing.title ?? entry.courseTitle;
    } else {
      byCode.set(code, { code, title: entry.courseTitle, count: 1 });
    }
  }

  return [...byCode.values()].sort(
    (left, right) => right.count - left.count || left.code.localeCompare(right.code),
  );
}

/** Minutes since midnight, for laying a class out on a week grid. */
export function minutesInto(time: string | null | undefined): number | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatTimeRange(startsAt: string | null, endsAt: string | null) {
  const format = (time: string | null) => {
    const minutes = minutesInto(time);
    if (minutes === null) return null;
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const suffix = hour < 12 ? "am" : "pm";
    const shown = hour % 12 === 0 ? 12 : hour % 12;
    return minute === 0 ? `${shown}${suffix}` : `${shown}:${String(minute).padStart(2, "0")}${suffix}`;
  };

  const start = format(startsAt);
  const end = format(endsAt);
  if (!start) return null;
  return end ? `${start}–${end}` : start;
}

export type ScheduleEntry = {
  personId: string;
  personName: string;
  entry: PersonClass;
  startsAt: number;
  endsAt: number;
};

/**
 * Everyone's classes on one day, in time order — the "where is everybody right
 * now" view. A class with no time cannot be placed, so it is left out rather
 * than dropped at midnight.
 */
export function scheduleForDay(
  people: { id: string; name: string; classes: PersonClass[] }[],
  day: WeekdayKey,
): ScheduleEntry[] {
  const entries: ScheduleEntry[] = [];

  for (const person of people) {
    for (const entry of person.classes) {
      if (!parseDays(entry.days).includes(day)) continue;
      const startsAt = minutesInto(entry.startsAt);
      const endsAt = minutesInto(entry.endsAt);
      if (startsAt === null) continue;
      entries.push({
        personId: person.id,
        personName: person.name,
        entry,
        startsAt,
        endsAt: endsAt ?? startsAt + 50,
      });
    }
  }

  return entries.sort(
    (left, right) => left.startsAt - right.startsAt || left.personName.localeCompare(right.personName),
  );
}
