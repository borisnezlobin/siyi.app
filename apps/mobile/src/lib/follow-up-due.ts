import { differenceInCalendarDays, format } from "date-fns";

export const followUpQuickChoices = [
  { label: "Today", daysAway: 0 },
  { label: "Tomorrow", daysAway: 1 },
  { label: "Next week", daysAway: 7 },
  { label: "In 2 weeks", daysAway: 14 },
] as const;

export function followUpDayFromDaysAway(
  daysAway: number,
  now: Date = new Date(),
) {
  const day = new Date(now);
  day.setDate(day.getDate() + daysAway);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function followUpDaysAway(day: Date, now: Date = new Date()) {
  return differenceInCalendarDays(day, now);
}

/**
 * A reminder for today is due this evening so it still has a useful window
 * left; any other day lands late afternoon, when there is time to act on it.
 */
export function followUpDueAt(day: Date, now: Date = new Date()) {
  const dueAt = new Date(day);
  dueAt.setHours(followUpDaysAway(day, now) === 0 ? 20 : 17, 0, 0, 0);
  return dueAt.toISOString();
}

export function followUpDayValue(day: Date) {
  return format(day, "yyyy-MM-dd");
}

export function followUpDayLabel(day: Date, now: Date = new Date()) {
  const daysAway = followUpDaysAway(day, now);
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return format(day, "EEE, MMM d");
}
