import type { Person } from "@/lib/types";

/** What a reminder needs to know about each person it is about. */
export type ReminderPerson = Pick<
  Person,
  "id" | "fullName" | "preferredName" | "profilePhotoUrl"
>;
// Generic over the person shape on purpose: the phone carries an extra
// profilePhotoPath on each one, and narrowing here would drop it.

export function reminderPersonName(person: ReminderPerson) {
  return person.preferredName ?? person.fullName;
}

/**
 * Who a reminder is about, in words.
 *
 * Two names then a count, rather than all of them: a reminder covering five
 * people writes a sentence the lock screen cuts off mid-name, and the part it
 * keeps is the least useful part. Two is enough to recognise which reminder
 * this is, and the count says the rest exist.
 */
export function reminderPeopleLabel(people: ReminderPerson[]): string {
  const names = people.map(reminderPersonName);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;

  const remaining = names.length - 2;
  return `${names[0]}, ${names[1]} and ${remaining} ${
    remaining === 1 ? "other" : "others"
  }`;
}

/**
 * The notification body. The reminder's own words come first because that is
 * what the reader is being reminded of; the names say which cat.
 */
export function reminderNotificationBody(
  text: string,
  people: ReminderPerson[],
): string {
  const label = reminderPeopleLabel(people);
  return label ? `${text} — ${label}` : text;
}

/**
 * Sorting a reminder's people so the two that get named are stable.
 *
 * Without this the pair in the notification depends on whatever order the rows
 * came back in, and the same reminder reads differently each time it fires.
 */
export function orderReminderPeople<T extends ReminderPerson>(people: T[]): T[] {
  return [...people].sort((left, right) =>
    reminderPersonName(left).localeCompare(reminderPersonName(right)),
  );
}
