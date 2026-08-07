import { brand } from "@/config/brand";
import { DEFAULT_REMINDER_INTERVALS } from "@/lib/constants";
import type { ReminderDefaults, RelationshipStrength } from "@/lib/types";

export type NotificationCandidate = {
  type: "overdue_contact" | "birthday" | "follow_up";
  relatedEntityId: string;
  scheduledFor: string;
  deduplicationKey: string;
  title: string;
  body: string;
  url: string;
  tag: string;
};

export type NotificationEvaluationInput = {
  userId: string;
  timezone: string;
  preferences: {
    pushEnabled: boolean;
    overdueContactEnabled: boolean;
    birthdayEnabled: boolean;
    reminderEnabled: boolean;
    reminderHourLocal: number;
    reminderDaysOfWeek: number[];
  };
  reminderDefaults?: ReminderDefaults;
  people: {
    id: string;
    fullName: string;
    preferredName: string | null;
    birthday: string | null;
    relationshipStrength: RelationshipStrength;
    reminderIntervalDays: number | null;
    remindersEnabled?: boolean;
    firstMetAt: string;
    lastInteractionAt: string | null;
  }[];
  reminders: {
    id: string;
    personId: string;
    text: string;
    dueAt: string;
    personName: string;
  }[];
};

type LocalDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  weekday: number;
  dateKey: string;
  dayNumber: number;
};

const weekDayIndex: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function localDateParts(date: Date, timezone: string): LocalDateParts {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const year = Number(values.year);
  const month = Number(values.month);
  const day = Number(values.day);

  return {
    year,
    month,
    day,
    hour: Number(values.hour),
    weekday: weekDayIndex[values.weekday] ?? 0,
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    dayNumber: Math.floor(Date.UTC(year, month - 1, day) / 86_400_000),
  };
}

function dateOnlyDayNumber(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function addCalendarDays(dateKey: string, days: number) {
  return dateOnlyDayNumber(dateKey) + days;
}

export function isNotificationEvaluationTime(
  timezone: string,
  preferences: Pick<
    NotificationEvaluationInput["preferences"],
    "pushEnabled" | "reminderHourLocal" | "reminderDaysOfWeek"
  >,
  now = new Date(),
) {
  const localNow = localDateParts(now, timezone);
  return Boolean(
    preferences.pushEnabled &&
      preferences.reminderHourLocal === localNow.hour &&
      preferences.reminderDaysOfWeek.includes(localNow.weekday),
  );
}

export function evaluateUserNotifications(
  input: NotificationEvaluationInput,
  now = new Date(),
): NotificationCandidate[] {
  const localNow = localDateParts(now, input.timezone);
  const preferences = input.preferences;

  if (!isNotificationEvaluationTime(input.timezone, preferences, now)) {
    return [];
  }

  const candidates: NotificationCandidate[] = [];
  const defaults = input.reminderDefaults ?? DEFAULT_REMINDER_INTERVALS;

  if (preferences.overdueContactEnabled) {
    for (const person of input.people) {
      if (person.remindersEnabled === false) continue;
      const intervalDays =
        person.reminderIntervalDays ?? defaults[person.relationshipStrength];
      const lastContact = localDateParts(
        new Date(person.lastInteractionAt ?? person.firstMetAt),
        input.timezone,
      );
      const dueDayNumber = addCalendarDays(lastContact.dateKey, intervalDays);

      if (localNow.dayNumber > dueDayNumber) {
        const displayName = person.preferredName ?? person.fullName;
        const dueKey = new Date(dueDayNumber * 86_400_000)
          .toISOString()
          .slice(0, 10);

        candidates.push({
          type: "overdue_contact",
          relatedEntityId: person.id,
          scheduledFor: now.toISOString(),
          deduplicationKey: `contact:${input.userId}:${person.id}:${dueKey}`,
          title: `${displayName} came to mind`,
          body: `It’s been a little while. Reach out whenever it feels right.`,
          url: `/people/${person.id}`,
          tag: `contact-${person.id}`,
        });
      }
    }
  }

  if (preferences.birthdayEnabled) {
    for (const person of input.people) {
      if (!person.birthday) continue;
      const [birthYear, birthdayMonth, birthdayDay] = person.birthday
        .split("-")
        .map(Number);
      let birthdayYear = localNow.year;
      let birthdayDayNumber = Math.floor(
        Date.UTC(birthdayYear, birthdayMonth - 1, birthdayDay) / 86_400_000,
      );
      if (birthdayDayNumber < localNow.dayNumber) {
        birthdayYear = localNow.year + 1;
        birthdayDayNumber = Math.floor(
          Date.UTC(birthdayYear, birthdayMonth - 1, birthdayDay) / 86_400_000,
        );
      }
      const daysUntil = birthdayDayNumber - localNow.dayNumber;
      // A birthday saved with a placeholder year would put them past 120, so
      // the reminder simply says nothing about the age.
      const turning = birthdayYear - birthYear;
      const hasPlausibleAge = turning > 0 && turning <= 120;

      if (daysUntil === 0 || daysUntil === 7) {
        const displayName = person.preferredName ?? person.fullName;
        const occasion = daysUntil === 0 ? "today" : "in one week";

        candidates.push({
          type: "birthday",
          relatedEntityId: person.id,
          scheduledFor: now.toISOString(),
          deduplicationKey: `birthday:${input.userId}:${person.id}:${localNow.year}:${daysUntil}`,
          title: `${displayName}’s birthday is ${occasion}`,
          body: [
            hasPlausibleAge ? `They turn ${turning}.` : null,
            daysUntil === 0
              ? "A quick message can mean a lot."
              : "You have time to plan a thoughtful hello.",
          ]
            .filter(Boolean)
            .join(" "),
          url: `/people/${person.id}`,
          tag: `birthday-${person.id}-${daysUntil}`,
        });
      }
    }
  }

  if (preferences.reminderEnabled) {
    for (const reminder of input.reminders) {
      const dueDate = localDateParts(new Date(reminder.dueAt), input.timezone);
      if (dueDate.dayNumber <= localNow.dayNumber) {
        candidates.push({
          type: "follow_up",
          relatedEntityId: reminder.id,
          scheduledFor: now.toISOString(),
          deduplicationKey: `reminder:${input.userId}:${reminder.id}:${dueDate.dateKey}`,
          title: `A reminder with ${reminder.personName}`,
          body: reminder.text,
          url: `/reminders?person=${reminder.personId}`,
          tag: `reminder-${reminder.id}`,
        });
      }
    }
  }

  return candidates.map((candidate) => ({
    ...candidate,
    title: candidate.title || brand.name,
  }));
}
