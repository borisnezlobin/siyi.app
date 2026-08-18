import { differenceInCalendarDays, format } from "date-fns";

export function reminderDayFromDaysAway(
  daysAway: number,
  now: Date = new Date(),
) {
  const day = new Date(now);
  day.setDate(day.getDate() + daysAway);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function reminderDaysAway(day: Date, now: Date = new Date()) {
  return differenceInCalendarDays(day, now);
}

/** "14:30" as hours and minutes, or null for anything else. */
export function parseTimeOfDay(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/** The hour a reminder lands on when nobody picked one. Shared with the web. */
export const defaultReminderHour = 9;

/**
 * A reminder with no time on it is due at nine in the morning, which is when a
 * day's worth of them is worth reading. A time the person actually chose beats
 * it. The two apps used to disagree here — the phone said early evening and the
 * website said noon — so the same reminder arrived at a different hour
 * depending on where it was written.
 */
export function reminderDueAt(
  day: Date,
  // Kept in the signature though the default no longer varies by how far away
  // the day is: every caller passes it, and a clock is what this would need
  // again the moment the default stops being one fixed hour.
  _now: Date = new Date(),
  timeOfDay = "",
) {
  const dueAt = new Date(day);
  const chosen = parseTimeOfDay(timeOfDay);
  if (chosen) {
    dueAt.setHours(chosen.hours, chosen.minutes, 0, 0);
    return dueAt.toISOString();
  }
  dueAt.setHours(defaultReminderHour, 0, 0, 0);
  return dueAt.toISOString();
}

/** The time part of a saved reminder, as "HH:mm" for a time field. */
export function reminderTimeValue(dueAt: string) {
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function reminderDayValue(day: Date) {
  return format(day, "yyyy-MM-dd");
}

export function reminderDayLabel(day: Date, now: Date = new Date()) {
  const daysAway = reminderDaysAway(day, now);
  if (daysAway === 0) return "Today";
  if (daysAway === 1) return "Tomorrow";
  return format(day, "EEE, MMM d");
}
