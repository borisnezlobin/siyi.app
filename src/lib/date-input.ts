import { format } from "date-fns";

export function todayDateInputValue(now: Date = new Date()) {
  return format(now, "yyyy-MM-dd");
}

export function isValidDateInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return (
    !Number.isNaN(parsed.getTime()) && format(parsed, "yyyy-MM-dd") === value
  );
}

export function toDateInputValue(timestamp: string | null | undefined) {
  if (!timestamp) return "";
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? "" : format(parsed, "yyyy-MM-dd");
}

export function isFutureDateInput(value: string, now: Date = new Date()) {
  return isValidDateInput(value) && value > todayDateInputValue(now);
}

/**
 * Today keeps the current clock time so an update logged now sorts after one
 * logged an hour ago; a backdated day lands at midday so it reads as that day
 * in every nearby timezone.
 */
export function timestampFromDateInput(value: string, now: Date = new Date()) {
  if (!isValidDateInput(value) || value === todayDateInputValue(now)) {
    return now.toISOString();
  }
  return new Date(`${value}T12:00:00`).toISOString();
}
