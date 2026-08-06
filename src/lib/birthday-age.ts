/**
 * The column is a date, so every saved birthday carries a year — but plenty of
 * them are a placeholder typed when only the day and month were known. A year
 * at or before 1900, or one implying an age past 120, is treated as no year at
 * all: the date still shows, the age simply does not.
 *
 * Dates are anchored at midday, the same way birthdays are rendered elsewhere,
 * so a timezone offset can never push the day across a boundary.
 */

const placeholderYearThreshold = 1900;
const maximumPlausibleAge = 120;

export function birthdayDate(birthday: string | null | undefined) {
  if (!birthday) return null;
  const parsed = new Date(`${birthday}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function hasHadBirthdayThisYear(born: Date, on: Date) {
  if (on.getMonth() !== born.getMonth()) return on.getMonth() > born.getMonth();
  return on.getDate() >= born.getDate();
}

/** Their age today, or null when the stored year cannot be trusted. */
export function ageOnDate(
  birthday: string | null | undefined,
  on: Date = new Date(),
) {
  const born = birthdayDate(birthday);
  if (!born || born.getFullYear() <= placeholderYearThreshold) return null;

  const yearsApart = on.getFullYear() - born.getFullYear();
  const age = hasHadBirthdayThisYear(born, on) ? yearsApart : yearsApart - 1;
  return age < 0 || age > maximumPlausibleAge ? null : age;
}

/**
 * The age they reach at their next birthday — or today's age when today is the
 * birthday, because that is the number they are turning right now.
 */
export function ageAtNextBirthday(
  birthday: string | null | undefined,
  on: Date = new Date(),
) {
  const age = ageOnDate(birthday, on);
  if (age === null) return null;
  const born = birthdayDate(birthday);
  if (!born) return null;

  const isBirthdayToday =
    born.getMonth() === on.getMonth() && born.getDate() === on.getDate();
  return isBirthdayToday ? age : age + 1;
}
