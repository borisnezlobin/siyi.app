/**
 * The phone's half of the calendar feed. The web builds the .ics itself; here
 * we only ever need the token and the three shapes of link that get handed to
 * a calendar app, so this is the parallel copy of those pieces — see
 * `src/lib/calendar-feed.ts`.
 */

/** 32 characters from a URL-safe alphabet, matching migration 0028's check. */
export const calendarTokenPattern = /^[A-Za-z0-9_-]{32}$/;

const tokenAlphabet =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";

export function createCalendarToken(
  randomBytes: (length: number) => Uint8Array,
) {
  return Array.from(randomBytes(32), (byte) => tokenAlphabet[byte % 64]).join(
    "",
  );
}

export function calendarFeedPath(token: string) {
  return `/calendar/${token}.ics`;
}

/**
 * `webcal:` is what makes a tap subscribe rather than save a one-off copy of
 * today's events. iOS hands it straight to Calendar; Google needs the https
 * form handed to its own subscribe page instead.
 */
export function webcalFeedUrl(token: string, origin: string) {
  return `webcal://${origin.replace(/^https?:\/\//, "")}${calendarFeedPath(token)}`;
}

export function httpsFeedUrl(token: string, origin: string) {
  return `${origin.replace(/\/$/, "")}${calendarFeedPath(token)}`;
}

export function googleSubscribeUrl(token: string, origin: string) {
  return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(
    httpsFeedUrl(token, origin),
  )}`;
}
