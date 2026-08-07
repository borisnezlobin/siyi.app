/**
 * A short list of calm hours rather than a full clock: both apps offer exactly
 * these, plus whatever hour is already saved so a stored value is never
 * silently unselected.
 */
const defaultReminderHours = [8, 10, 12, 18, 20];

export function reminderHourOptions(savedHour: number): number[] {
  return defaultReminderHours.includes(savedHour)
    ? defaultReminderHours
    : [...defaultReminderHours, savedHour].sort((left, right) => left - right);
}

export function formatReminderHour(hour: number): string {
  return `${hour % 12 || 12}${hour < 12 ? "am" : "pm"}`;
}
