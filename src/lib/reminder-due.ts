/**
 * The hour a reminder lands on when nobody picked one.
 *
 * Nine in the morning, which is when a day's worth of them is worth reading.
 * The two apps used to disagree — the phone said early evening and the website
 * said noon — so the same reminder arrived at a different hour depending on
 * where it had been written. The phone's twin of this lives in
 * `apps/mobile/src/lib/reminder-due.ts`.
 */
export const defaultReminderHour = 9;

/** "09:00", for a time input that has been left empty. */
export const defaultReminderTimeValue = `${String(defaultReminderHour).padStart(2, "0")}:00`;
