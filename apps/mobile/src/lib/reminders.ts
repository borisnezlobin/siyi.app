import {
  daysUntilBirthday as daysUntilNextBirthday,
  nextBirthdayDate,
} from "@/lib/birthday-calendar";
import {
  defaultReminderIntervals,
  type Person,
  type ReminderDefaults,
} from "@/lib/types";

const millisecondsPerDay = 86_400_000;

function localDayNumber(date: Date) {
  return Math.floor(
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ).getTime() / millisecondsPerDay,
  );
}

export function daysBetween(left: Date, right: Date) {
  return localDayNumber(right) - localDayNumber(left);
}

export function remindersAreOn(person: Pick<Person, "remindersEnabled">) {
  return person.remindersEnabled !== false;
}

export function reminderDueDate(
  person: Person,
  defaults: ReminderDefaults = defaultReminderIntervals,
) {
  const latestInteraction = new Date(
    person.lastInteractionAt || person.firstMetAt,
  );
  const interval =
    person.reminderIntervalDays || defaults[person.relationshipStrength];
  const due = new Date(latestInteraction);
  due.setDate(due.getDate() + interval);
  return due;
}

export function overdueDays(
  person: Person,
  now = new Date(),
  defaults: ReminderDefaults = defaultReminderIntervals,
) {
  if (person.status !== "active" || !remindersAreOn(person)) return 0;
  return Math.max(0, daysBetween(reminderDueDate(person, defaults), now));
}

export function nextReminderDate(
  person: Person,
  defaults: ReminderDefaults = defaultReminderIntervals,
) {
  if (person.status !== "active" || !remindersAreOn(person)) return null;
  return reminderDueDate(person, defaults);
}

export function nextBirthday(birthday: string | null, now = new Date()) {
  return nextBirthdayDate(birthday, now);
}

export function daysUntilBirthday(birthday: string | null, now = new Date()) {
  return daysUntilNextBirthday(birthday, now);
}
