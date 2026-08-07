import { differenceInCalendarDays } from "date-fns";

export type ReminderBucket = "overdue" | "today" | "week" | "later";

export const reminderBucketOrder: ReminderBucket[] = [
  "overdue",
  "today",
  "week",
  "later",
];

export const reminderBucketLabels: Record<ReminderBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
};

export const reminderBucketEmptyLabels: Record<ReminderBucket, string> = {
  overdue: "Nothing has slipped.",
  today: "Nothing due today.",
  week: "The rest of the week is clear.",
  later: "Nothing scheduled further out.",
};

/**
 * "This week" is the six days after today, so a reminder seven days out reads
 * as "later" rather than crowding the week you are actually looking at.
 */
export function reminderBucket(
  dueAt: string | Date,
  now: Date = new Date(),
): ReminderBucket {
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  const daysAway = differenceInCalendarDays(due, now);
  if (daysAway < 0) return "overdue";
  if (daysAway === 0) return "today";
  if (daysAway <= 6) return "week";
  return "later";
}

type BucketableReminder = {
  dueAt: string;
  completedAt?: string | null;
};

export function groupRemindersByBucket<Item extends BucketableReminder>(
  reminders: Item[],
  now: Date = new Date(),
) {
  const groups: Record<ReminderBucket, Item[]> = {
    overdue: [],
    today: [],
    week: [],
    later: [],
  };
  const completed: Item[] = [];

  for (const reminder of reminders) {
    if (reminder.completedAt) {
      completed.push(reminder);
      continue;
    }
    groups[reminderBucket(reminder.dueAt, now)].push(reminder);
  }

  for (const bucket of reminderBucketOrder) {
    groups[bucket].sort(
      (left, right) =>
        new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime(),
    );
  }

  return { groups, completed };
}

export function countsByBucket(
  groups: Record<ReminderBucket, unknown[]>,
): Record<ReminderBucket, number> {
  return {
    overdue: groups.overdue.length,
    today: groups.today.length,
    week: groups.week.length,
    later: groups.later.length,
  };
}

export function reminderDueLabel(
  dueAt: string | Date,
  now: Date = new Date(),
): string {
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  const daysAway = differenceInCalendarDays(due, now);
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  if (daysAway === -1) return "1 day late";
  if (daysAway < 0) return `${Math.abs(daysAway)} days late`;
  return `In ${daysAway} days`;
}
