import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";

/**
 * Every relative date a user reads is worded here, on both platforms, so the
 * web cannot say "1 day ago" while the phone says "Yesterday".
 *
 * The unit is the calendar day, never elapsed hours: something written at
 * 11:58pm reads as "Yesterday" two minutes later, because that is the day the
 * person remembers it happening on.
 */

/** Past this many days back, a real date says more than a countdown does. */
const namedDayLimit = 7;

function asDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

function calendarDate(date: Date, now: Date) {
  return format(date, date.getFullYear() === now.getFullYear() ? "MMM d" : "MMM d, yyyy");
}

/**
 * Today, Yesterday, N days ago, then the date itself.
 */
export function relativeDateLabel(value: string | Date, now: Date = new Date()) {
  const date = asDate(value);
  const daysBack = differenceInCalendarDays(now, date);
  if (daysBack <= 0) return "Today";
  if (daysBack === 1) return "Yesterday";
  if (daysBack < namedDayLimit) return `${daysBack} days ago`;
  return calendarDate(date, now);
}

export function lastSeenLabel(
  value: string | Date | null | undefined,
  now: Date = new Date(),
) {
  if (!value) return "No interactions yet";
  return relativeDateLabel(value, now);
}

/**
 * The whole line, for the one place that says it mid-sentence rather than on
 * its own. Blindly lower-casing the label turned "Jul 1" into "jul 1" and read
 * "Last interaction no interactions yet" for somebody never contacted, so only
 * the relative phrases fold down and a real date keeps its capital month.
 */
export function lastInteractionLine(
  value: string | Date | null | undefined,
  now: Date = new Date(),
) {
  if (!value) return "No interactions yet";
  const label = relativeDateLabel(value, now);
  const isRelativePhrase = /^(Today|Yesterday|\d+ days ago)$/.test(label);
  return `Last interaction ${isRelativePhrase ? label.toLowerCase() : label}`;
}

/**
 * "Due in 5 days" scans quickly but does not answer "which day is that?", so
 * the date rides along whenever the phrase does not already name the day.
 */
export function dueLabelForDaysAway(
  daysAway: number,
  dueAt: string | Date,
  now: Date = new Date(),
) {
  if (daysAway === 0) return "Due today";
  if (daysAway === 1) return "Due tomorrow";
  const on = calendarDate(asDate(dueAt), now);
  if (daysAway < 0) {
    const days = Math.abs(daysAway);
    return `${days} day${days === 1 ? "" : "s"} overdue · ${on}`;
  }
  return `Due in ${daysAway} days · ${on}`;
}

export function dueDateLabel(dueAt: string | Date, now: Date = new Date()) {
  const due = asDate(dueAt);
  return dueLabelForDaysAway(differenceInCalendarDays(due, now), due, now);
}

/**
 * For callers that only carry a day count. The date is reconstructed from it,
 * which is exact because the count is itself a calendar-day difference.
 */
export function dueDateLabelFromDaysAway(daysAway: number, now: Date = new Date()) {
  return dueLabelForDaysAway(daysAway, addDays(startOfDay(now), daysAway), now);
}
