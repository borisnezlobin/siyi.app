import { differenceInCalendarDays } from "date-fns";

export type FollowUpBucket = "overdue" | "today" | "week" | "later";

export const followUpBucketOrder: FollowUpBucket[] = [
  "overdue",
  "today",
  "week",
  "later",
];

export const followUpBucketLabels: Record<FollowUpBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
};

export const followUpBucketEmptyLabels: Record<FollowUpBucket, string> = {
  overdue: "Nothing has slipped.",
  today: "Nothing due today.",
  week: "The rest of the week is clear.",
  later: "Nothing scheduled further out.",
};

/**
 * "This week" is the six days after today, so a follow-up seven days out reads
 * as "later" rather than crowding the week you are actually looking at.
 */
export function followUpBucket(
  dueAt: string | Date,
  now: Date = new Date(),
): FollowUpBucket {
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  const daysAway = differenceInCalendarDays(due, now);
  if (daysAway < 0) return "overdue";
  if (daysAway === 0) return "today";
  if (daysAway <= 6) return "week";
  return "later";
}

type BucketableFollowUp = {
  dueAt: string;
  completedAt?: string | null;
};

export function groupFollowUpsByBucket<Item extends BucketableFollowUp>(
  followUps: Item[],
  now: Date = new Date(),
) {
  const groups: Record<FollowUpBucket, Item[]> = {
    overdue: [],
    today: [],
    week: [],
    later: [],
  };
  const completed: Item[] = [];

  for (const followUp of followUps) {
    if (followUp.completedAt) {
      completed.push(followUp);
      continue;
    }
    groups[followUpBucket(followUp.dueAt, now)].push(followUp);
  }

  for (const bucket of followUpBucketOrder) {
    groups[bucket].sort(
      (left, right) =>
        new Date(left.dueAt).getTime() - new Date(right.dueAt).getTime(),
    );
  }

  return { groups, completed };
}

export function countsByBucket(
  groups: Record<FollowUpBucket, unknown[]>,
): Record<FollowUpBucket, number> {
  return {
    overdue: groups.overdue.length,
    today: groups.today.length,
    week: groups.week.length,
    later: groups.later.length,
  };
}

export function followUpDueLabel(
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
