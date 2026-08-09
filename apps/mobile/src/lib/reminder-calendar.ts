/**
 * Reminders and birthdays laid out on a calendar.
 *
 * Pure, and shared by both apps: what falls on which day, what a period is
 * called, and where the arrows go. Only the drawing differs between the web and
 * the phone.
 */

export type CalendarScope = "day" | "week" | "month";

export const calendarScopes: CalendarScope[] = ["day", "week", "month"];

export type CalendarPerson = {
  id: string;
  name: string;
  photoUrl?: string | null;
};

export type CalendarReminder = {
  id: string;
  text: string;
  dueAt: string;
  completedAt?: string | null;
  person?: CalendarPerson | null;
};

export type CalendarBirthday = {
  personId: string;
  name: string;
  photoUrl?: string | null;
  /** The age they turn on this day, when the year they were born is known. */
  turning: number | null;
};

export type CalendarDay = {
  /** YYYY-MM-DD in local time, and the key React rows are drawn with. */
  key: string;
  date: Date;
  dayOfMonth: number;
  /** False for the days either side of a month that fill out its grid. */
  inScope: boolean;
  isToday: boolean;
  reminders: CalendarReminder[];
  birthdays: CalendarBirthday[];
};

export type BirthdayPerson = {
  id: string;
  fullName: string;
  preferredName?: string | null;
  profilePhotoUrl?: string | null;
  birthday?: string | null;
  status?: string;
};

export function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Weeks run Sunday to Saturday, as the calendars everyone here grew up with do. */
export function startOfWeek(date: Date): Date {
  return addDays(startOfDay(date), -startOfDay(date).getDay());
}

/**
 * The days a view covers.
 *
 * A month runs from the Sunday before the first to the Saturday after the last,
 * so the grid is always whole weeks and never has a ragged edge.
 */
export function calendarRange(scope: CalendarScope, anchor: Date): { start: Date; end: Date } {
  if (scope === "day") {
    const start = startOfDay(anchor);
    return { start, end: start };
  }
  if (scope === "week") {
    const start = startOfWeek(anchor);
    return { start, end: addDays(start, 6) };
  }

  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const lastOfMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start: startOfWeek(firstOfMonth), end: addDays(startOfWeek(lastOfMonth), 6) };
}

/** Whether a birthday falls on a given day, whatever year it was in. */
function birthdayFallsOn(birthday: string, date: Date): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday.trim());
  if (!parts) return false;
  return Number(parts[2]) === date.getMonth() + 1 && Number(parts[3]) === date.getDate();
}

function birthYear(birthday: string): number | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday.trim());
  if (!parts) return null;
  const year = Number(parts[1]);
  // 1900 is what a date picker lands on when somebody scrolls past the end,
  // and an age of 126 on a calendar helps nobody.
  return year > 1900 ? year : null;
}

export function buildCalendarDays({
  scope,
  anchor,
  reminders,
  people,
  now = new Date(),
}: {
  scope: CalendarScope;
  anchor: Date;
  reminders: CalendarReminder[];
  people: BirthdayPerson[];
  now?: Date;
}): CalendarDay[] {
  const { start, end } = calendarRange(scope, anchor);
  const todayKey = dayKey(now);
  const anchorMonth = anchor.getMonth();

  const remindersByDay = new Map<string, CalendarReminder[]>();
  for (const reminder of reminders) {
    const due = new Date(reminder.dueAt);
    if (Number.isNaN(due.getTime())) continue;
    const key = dayKey(due);
    remindersByDay.set(key, [...(remindersByDay.get(key) ?? []), reminder]);
  }

  const withBirthdays = people.filter(
    (person) => person.birthday && person.status !== "archived",
  );

  const days: CalendarDay[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const key = dayKey(date);
    const onThisDay = remindersByDay.get(key) ?? [];

    days.push({
      key,
      date,
      dayOfMonth: date.getDate(),
      inScope: scope === "month" ? date.getMonth() === anchorMonth : true,
      isToday: key === todayKey,
      // Soonest first within a day, so a morning reminder reads before an
      // evening one rather than in whatever order the rows arrived.
      reminders: [...onThisDay].sort(
        (left, right) => new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime(),
      ),
      birthdays: withBirthdays
        .filter((person) => birthdayFallsOn(person.birthday!, date))
        .map((person) => {
          const born = birthYear(person.birthday!);
          return {
            personId: person.id,
            name: person.preferredName || person.fullName,
            photoUrl: person.profilePhotoUrl,
            turning: born === null ? null : date.getFullYear() - born,
          };
        }),
    });
  }

  return days;
}

export function shiftAnchor(scope: CalendarScope, anchor: Date, direction: -1 | 1): Date {
  if (scope === "day") return addDays(anchor, direction);
  if (scope === "week") return addDays(anchor, direction * 7);
  // Anchored to the first, so stepping from the 31st does not skip a month
  // that has only thirty days in it.
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

export function calendarTitle(scope: CalendarScope, anchor: Date): string {
  if (scope === "month") {
    return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  if (scope === "day") {
    return anchor.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  const { start, end } = calendarRange("week", anchor);
  const sameMonth = start.getMonth() === end.getMonth();
  const from = start.toLocaleDateString(undefined, {
    day: "numeric",
    month: sameMonth ? undefined : "short",
  });
  const to = end.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${from} – ${to}`;
}

/** Sunday first, matching the grid. */
export const weekdayInitials = ["S", "M", "T", "W", "T", "F", "S"];

export function countOnDay(day: CalendarDay): number {
  return day.reminders.length + day.birthdays.length;
}
