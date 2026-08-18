import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { DEFAULT_REMINDER_INTERVALS } from "@/lib/constants";
import type { Person, ReminderDefaults } from "@/lib/types";

export type ContactReminderState = {
  intervalDays: number;
  dueAt: Date;
  overdueDays: number;
  isOverdue: boolean;
};

export function getEffectiveReminderInterval(
  person: Pick<Person, "relationshipStrength" | "reminderIntervalDays">,
  defaults: ReminderDefaults = DEFAULT_REMINDER_INTERVALS,
): number {
  return person.reminderIntervalDays ?? defaults[person.relationshipStrength];
}

export function getContactReminderState(
  person: Pick<
    Person,
    | "relationshipStrength"
    | "reminderIntervalDays"
    | "remindersEnabled"
    | "status"
    | "firstMetAt"
    | "lastInteractionAt"
  >,
  now: Date = new Date(),
  defaults: ReminderDefaults = DEFAULT_REMINDER_INTERVALS,
): ContactReminderState | null {
  if (person.status !== "active" || person.remindersEnabled === false) {
    return null;
  }

  const intervalDays = getEffectiveReminderInterval(person, defaults);
  const lastContactAt = new Date(person.lastInteractionAt ?? person.firstMetAt);
  const dueAt = addDays(startOfDay(lastContactAt), intervalDays);
  const overdueDays = Math.max(
    0,
    differenceInCalendarDays(startOfDay(now), dueAt),
  );

  return {
    intervalDays,
    dueAt,
    overdueDays,
    isOverdue: startOfDay(now) > dueAt,
  };
}

