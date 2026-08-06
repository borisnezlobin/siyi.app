import { format } from "date-fns";

const monthNumbers: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number) {
  if (month === 2 && isLeapYear(year)) return 29;
  return monthLengths[month - 1];
}

/**
 * Built from the numbers rather than from a Date, so a day never drifts into
 * its neighbour on a machine running east or west of UTC.
 */
function calendarDate(year: number, month: number, day: number) {
  if (year < 1000 || year > 9999) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Strips the punctuation, ordinals, and spacing people type without thinking. */
function tidy(value: string) {
  return value
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .replace(/(\d+)(st|nd|rd|th)\b/g, "$1")
    .replace(/\s*([-/])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reads a typed date in whatever shape it arrives and returns it as YYYY-MM-DD,
 * or null when it cannot be read with certainty. A rejected date is far better
 * than a confidently wrong one, so nothing here guesses: no two-digit years, no
 * missing years, and no impossible days such as 2004-02-31.
 *
 * Two numbers that could each be a month are read month-first (03/18/2004 is
 * March 18th), matching where this app's people are. When the first number is
 * too large to be a month, that same rule reads it as the day instead, so
 * 18/03/2004 is also March 18th.
 */
export function parseDateInput(value: string | null | undefined) {
  if (!value) return null;
  const cleaned = tidy(value);
  if (!cleaned) return null;

  const yearFirst = cleaned.match(/^(\d{4})[-/ ](\d{1,2})[-/ ](\d{1,2})$/);
  if (yearFirst) {
    return calendarDate(
      Number(yearFirst[1]),
      Number(yearFirst[2]),
      Number(yearFirst[3]),
    );
  }

  const numeric = cleaned.match(/^(\d{1,2})[-/ ](\d{1,2})[-/ ](\d{4})$/);
  if (numeric) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    const year = Number(numeric[3]);
    const monthFirst = first <= 12;
    return calendarDate(
      year,
      monthFirst ? first : second,
      monthFirst ? second : first,
    );
  }

  const monthNamed = cleaned.match(/^([a-z]+) (\d{1,2}) (\d{4})$/);
  if (monthNamed) {
    const month = monthNumbers[monthNamed[1]];
    if (!month) return null;
    return calendarDate(Number(monthNamed[3]), month, Number(monthNamed[2]));
  }

  const dayFirstNamed = cleaned.match(/^(\d{1,2}) ([a-z]+) (\d{4})$/);
  if (dayFirstNamed) {
    const month = monthNumbers[dayFirstNamed[2]];
    if (!month) return null;
    return calendarDate(
      Number(dayFirstNamed[3]),
      month,
      Number(dayFirstNamed[1]),
    );
  }

  return null;
}

export function todayDateInputValue(now: Date = new Date()) {
  return format(now, "yyyy-MM-dd");
}

export function isValidDateInput(value: string) {
  return parseDateInput(value) !== null;
}

export function toDateInputValue(timestamp: string | null | undefined) {
  if (!timestamp) return "";
  const parsed = new Date(timestamp);
  return Number.isNaN(parsed.getTime()) ? "" : format(parsed, "yyyy-MM-dd");
}

export function isFutureDateInput(value: string, now: Date = new Date()) {
  const parsed = parseDateInput(value);
  return parsed !== null && parsed > todayDateInputValue(now);
}

export function daysAgoDateInputValue(days: number, now: Date = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return format(date, "yyyy-MM-dd");
}

/** Midday, so the day reads the same however the machine's clock is set. */
export function dateFromDateInput(value: string) {
  const parsed = parseDateInput(value);
  if (!parsed) return null;
  const [year, month, day] = parsed.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

/**
 * Spells the month out, so someone who typed 03/04/2004 can see at a glance
 * whether we understood March or April.
 */
export function dateInputLabel(value: string) {
  const date = dateFromDateInput(value);
  return date ? format(date, "MMMM d, yyyy") : "";
}

/**
 * Today keeps the current clock time so an update logged now sorts after one
 * logged an hour ago; a backdated day lands at midday so it reads as that day
 * in every nearby timezone.
 */
export function timestampFromDateInput(value: string, now: Date = new Date()) {
  const parsed = parseDateInput(value);
  if (!parsed || parsed === todayDateInputValue(now)) {
    return now.toISOString();
  }
  return new Date(`${parsed}T12:00:00`).toISOString();
}
