import { birthdayCountdownLabel } from "@/lib/birthday-calendar";

/**
 * What the Today screen shows, on both platforms.
 *
 * The two apps read reminders through different modules, so this takes the
 * plain numbers each side already has rather than a person or a reminder row.
 * Everything a user reads — the order, the wording, the cut-off — is decided
 * here so the phone and the web cannot drift apart again.
 */

export type AgendaKind = "reminder" | "check-in" | "birthday";
export type AgendaStatus = "overdue" | "today" | "upcoming";

export type AgendaItem = {
  key: string;
  kind: AgendaKind;
  status: AgendaStatus;
  /** Negative when it is already past due. */
  daysAway: number;
  personId: string;
  reminderId: string | null;
  title: string;
  detail: string;
};

/** Today looks two weeks ahead. Anything further out belongs on Reminders. */
export const agendaWindowDays = 14;

/** How many rows the list shows before it stops being a glance. */
export const agendaLimit = 12;

const dayInMilliseconds = 86_400_000;

export type AgendaInput = {
  reminders: {
    id: string;
    personId: string;
    text: string;
    personName: string;
    daysAway: number;
  }[];
  overdueCheckIns: {
    personId: string;
    name: string;
    daysOverdue: number;
  }[];
  birthdays: {
    personId: string;
    name: string;
    daysAway: number;
    turningAge: number | null;
  }[];
};

export function agendaStatusFor(daysAway: number): AgendaStatus {
  if (daysAway < 0) return "overdue";
  if (daysAway === 0) return "today";
  return "upcoming";
}

export function agendaDueLabel(daysAway: number) {
  if (daysAway < 0) {
    const days = Math.abs(daysAway);
    return `${days} day${days === 1 ? "" : "s"} overdue`;
  }
  if (daysAway === 0) return "Due today";
  if (daysAway === 1) return "Due tomorrow";
  return `Due in ${daysAway} days`;
}

export function buildTodayAgenda(input: AgendaInput): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const reminder of input.reminders) {
    if (reminder.daysAway > agendaWindowDays) continue;
    items.push({
      key: `reminder-${reminder.id}`,
      kind: "reminder",
      status: agendaStatusFor(reminder.daysAway),
      daysAway: reminder.daysAway,
      personId: reminder.personId,
      reminderId: reminder.id,
      title: reminder.text,
      detail: `${reminder.personName} · ${agendaDueLabel(reminder.daysAway)}`,
    });
  }

  for (const checkIn of input.overdueCheckIns) {
    if (checkIn.daysOverdue <= 0) continue;
    items.push({
      key: `check-in-${checkIn.personId}`,
      kind: "check-in",
      status: "overdue",
      daysAway: -checkIn.daysOverdue,
      personId: checkIn.personId,
      reminderId: null,
      title: `Check in with ${checkIn.name}`,
      detail: agendaDueLabel(-checkIn.daysOverdue),
    });
  }

  for (const birthday of input.birthdays) {
    if (birthday.daysAway < 0 || birthday.daysAway > agendaWindowDays) continue;
    const countdown = birthdayCountdownLabel(birthday.daysAway);
    items.push({
      key: `birthday-${birthday.personId}`,
      kind: "birthday",
      status: agendaStatusFor(birthday.daysAway),
      daysAway: birthday.daysAway,
      personId: birthday.personId,
      reminderId: null,
      title: `${birthday.name}’s birthday`,
      detail:
        birthday.turningAge === null
          ? countdown
          : `${countdown} · turning ${birthday.turningAge}`,
    });
  }

  return items.sort(
    (left, right) =>
      left.daysAway - right.daysAway || left.key.localeCompare(right.key),
  );
}

/** The two numbers above the list: what is late, and what is merely close. */
export function agendaCounts(items: AgendaItem[]) {
  return {
    needAttention: items.filter((item) => item.status !== "upcoming").length,
    comingUp: items.filter((item) => item.status === "upcoming").length,
  };
}

type SuggestablePerson = {
  id: string;
  status?: string | null;
  firstMetAt: string;
  lastInteractionAt?: string | null;
};

/**
 * A stable shuffle: the same three people all day, a different three tomorrow.
 * It only breaks ties, so the suggestion still leans on who you have left
 * longest.
 */
export function dailyRotationScore(personId: string, today = new Date()) {
  const dateKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  let score = 2166136261;
  for (const character of `${dateKey}:${personId}`) {
    score ^= character.charCodeAt(0);
    score = Math.imul(score, 16777619);
  }
  return score >>> 0;
}

/** People met in the last week, newest first — the "New in your circle" row. */
export function recentlyMetPeople<T extends SuggestablePerson>(
  people: T[],
  today = new Date(),
  limit = 4,
): T[] {
  return people
    .filter((person) => person.status !== "archived")
    .filter(
      (person) =>
        today.getTime() - new Date(person.firstMetAt).getTime() <=
        7 * dayInMilliseconds,
    )
    .sort(
      (left, right) =>
        new Date(right.firstMetAt).getTime() -
        new Date(left.firstMetAt).getTime(),
    )
    .slice(0, limit);
}

/**
 * Who to offer under "Have you checked in recently?".
 *
 * Anyone already named elsewhere on the screen is excluded, because the same
 * face twice reads as a bug. Longest since you spoke leads.
 */
export function pickCheckInSuggestions<T extends SuggestablePerson>(
  people: T[],
  excludeIds: readonly string[] = [],
  today = new Date(),
  limit = 3,
): T[] {
  const excluded = new Set(excludeIds);
  return people
    .filter((person) => person.status === "active" && !excluded.has(person.id))
    .sort((left, right) => {
      const leftSeen = new Date(
        left.lastInteractionAt || left.firstMetAt,
      ).getTime();
      const rightSeen = new Date(
        right.lastInteractionAt || right.firstMetAt,
      ).getTime();
      return (
        leftSeen - rightSeen ||
        dailyRotationScore(left.id, today) - dailyRotationScore(right.id, today)
      );
    })
    .slice(0, limit);
}
