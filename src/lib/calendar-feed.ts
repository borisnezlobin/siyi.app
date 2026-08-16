import { ageOnDate } from "@/lib/birthday-age";
import { brand } from "@/config/brand";
import type { Person, Reminder } from "@/lib/types";

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
 * `webcal:` is what makes a click subscribe rather than download a one-off copy
 * of today's events. Apple Calendar and Outlook both register the scheme;
 * Google needs the https form handed to its own subscribe page instead.
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

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * RFC 5545 caps a line at 75 octets and continues it with a leading space.
 * Counting octets rather than characters matters: a name with an accent in it
 * is two bytes per character, and a client that reads a split multi-byte
 * character drops the whole event.
 */
function foldLine(line: string) {
  const encoder = new TextEncoder();
  const folded: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const character of line) {
    const size = encoder.encode(character).length;
    // The continuation space costs one of the 75, so wrapped lines hold 74.
    const limit = folded.length === 0 ? 75 : 74;
    if (currentBytes + size > limit) {
      folded.push(current);
      current = "";
      currentBytes = 0;
    }
    current += character;
    currentBytes += size;
  }

  folded.push(current);
  return folded.map((part, index) => (index === 0 ? part : ` ${part}`));
}

function stampDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function personName(person: Pick<Person, "fullName" | "preferredName">) {
  return person.preferredName || person.fullName;
}

type CalendarEvent = {
  uid: string;
  summary: string;
  description: string;
  /** All-day events carry a date; timed events carry an instant. */
  start: { kind: "date"; value: string } | { kind: "instant"; value: Date };
  yearly?: boolean;
};

function nextDay(isoDate: string) {
  const day = new Date(`${isoDate}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10).replace(/-/g, "");
}

function renderEvent(event: CalendarEvent, stamp: string, host: string) {
  const lines = [
    "BEGIN:VEVENT",
    `UID:${event.uid}@${host}`,
    `DTSTAMP:${stamp}`,
  ];

  if (event.start.kind === "date") {
    const day = event.start.value.replace(/-/g, "");
    lines.push(`DTSTART;VALUE=DATE:${day}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(event.start.value)}`);
    lines.push("TRANSP:TRANSPARENT");
  } else {
    const startsAt = stampDate(event.start.value);
    const endsAt = stampDate(
      new Date(event.start.value.getTime() + 30 * 60 * 1000),
    );
    lines.push(`DTSTART:${startsAt}`);
    lines.push(`DTEND:${endsAt}`);
  }

  if (event.yearly) lines.push("RRULE:FREQ=YEARLY");
  lines.push(`SUMMARY:${escapeText(event.summary)}`);
  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

/**
 * Birthdays repeat yearly from the stored date; reminders are single 30-minute
 * events at the time they are due. Nothing carries a VALARM — {@link brand}
 * already sends its own notification, and a second one from the calendar is
 * the same reminder twice.
 */
export function buildCalendarFeed({
  people,
  reminders,
  origin,
  now = new Date(),
}: {
  people: Pick<Person, "id" | "fullName" | "preferredName" | "birthday">[];
  reminders: Pick<Reminder, "id" | "text" | "dueAt" | "completedAt" | "people">[];
  origin: string;
  now?: Date;
}) {
  const host = origin.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const stamp = stampDate(now);

  const events: CalendarEvent[] = [];

  for (const person of people) {
    if (!person.birthday) continue;
    // The event repeats forever, so the description cannot hold an age — it
    // would be wrong every year but this one. The birth year does not move.
    const bornIn =
      ageOnDate(person.birthday, now) === null
        ? ""
        : ` Born in ${person.birthday.slice(0, 4)}.`;
    events.push({
      uid: `birthday-${person.id}`,
      summary: `${personName(person)}'s birthday`,
      description: `From ${brand.name}.${bornIn}`,
      start: { kind: "date", value: person.birthday },
      yearly: true,
    });
  }

  for (const reminder of reminders) {
    if (reminder.completedAt) continue;
    const dueAt = new Date(reminder.dueAt);
    if (Number.isNaN(dueAt.getTime())) continue;
    const names = reminder.people.map(personName).join(", ");
    events.push({
      uid: `reminder-${reminder.id}`,
      summary: names ? `${reminder.text} — ${names}` : reminder.text,
      description: `A reminder from ${brand.name}.`,
      start: { kind: "instant", value: dueAt },
    });
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${brand.name}//Calendar feed//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(brand.name)}`,
    `X-WR-CALDESC:${escapeText(`Birthdays and reminders from ${brand.name}.`)}`,
    // A subscribed calendar refreshes on the client's own schedule; both of
    // these ask for daily, which is as often as a birthday can change meaning.
    "REFRESH-INTERVAL;VALUE=DURATION:P1D",
    "X-PUBLISHED-TTL:P1D",
    ...events.flatMap((event) => renderEvent(event, stamp, host)),
    "END:VCALENDAR",
  ];

  return `${lines.flatMap(foldLine).join("\r\n")}\r\n`;
}
