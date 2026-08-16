import { describe, expect, it } from "vitest";
import {
  buildCalendarFeed,
  calendarTokenPattern,
  createCalendarToken,
  googleSubscribeUrl,
  httpsFeedUrl,
  webcalFeedUrl,
} from "@/lib/calendar-feed";

const origin = "https://siyi.app";

function feed(
  overrides: Partial<Parameters<typeof buildCalendarFeed>[0]> = {},
) {
  return buildCalendarFeed({
    people: [],
    reminders: [],
    origin,
    now: new Date("2026-08-16T12:00:00Z"),
    ...overrides,
  });
}

const person = {
  id: "person-1",
  fullName: "Amelia Okonkwo",
  preferredName: "Mia",
  birthday: "2004-03-09",
};

describe("createCalendarToken", () => {
  it("produces a token the column and the route both accept", () => {
    const token = createCalendarToken((length) =>
      Uint8Array.from({ length }, (_, index) => index * 7),
    );
    expect(token).toHaveLength(32);
    expect(calendarTokenPattern.test(token)).toBe(true);
  });
});

describe("feed urls", () => {
  const token = "a".repeat(32);

  it("hands Apple and Outlook a webcal link so a click subscribes", () => {
    expect(webcalFeedUrl(token, origin)).toBe(
      `webcal://siyi.app/calendar/${token}.ics`,
    );
  });

  it("hands Google the https link, because its subscribe page takes one", () => {
    expect(httpsFeedUrl(token, origin)).toBe(
      `https://siyi.app/calendar/${token}.ics`,
    );
    expect(googleSubscribeUrl(token, origin)).toContain(
      encodeURIComponent(httpsFeedUrl(token, origin)),
    );
  });
});

describe("buildCalendarFeed", () => {
  it("wraps an empty calendar with what a client needs to subscribe", () => {
    const ics = feed();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:P1D");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("repeats a birthday every year as an all-day event", () => {
    const ics = feed({ people: [person] });
    expect(ics).toContain("SUMMARY:Mia's birthday");
    expect(ics).toContain("DTSTART;VALUE=DATE:20040309");
    expect(ics).toContain("DTEND;VALUE=DATE:20040310");
    expect(ics).toContain("RRULE:FREQ=YEARLY");
    expect(ics).toContain("Born in 2004.");
  });

  it("carries no age, which would be wrong every year but this one", () => {
    expect(feed({ people: [person] })).not.toContain("They turn");
  });

  it("says nothing about a birth year it does not trust", () => {
    const ics = feed({
      people: [{ ...person, birthday: "1900-03-09" }],
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:19000309");
    expect(ics).not.toContain("Born in");
  });

  it("gives a reminder its due time and everyone it is about", () => {
    const ics = feed({
      people: [person],
      reminders: [
        {
          id: "reminder-1",
          text: "Feed the cat",
          dueAt: "2026-09-01T17:00:00.000Z",
          completedAt: null,
          people: [
            { id: person.id, fullName: person.fullName, preferredName: "Mia", profilePhotoUrl: null },
            { id: "p2", fullName: "Sam Reyes", preferredName: null, profilePhotoUrl: null },
          ],
        },
      ],
    });
    expect(ics).toContain("SUMMARY:Feed the cat — Mia\\, Sam Reyes");
    expect(ics).toContain("DTSTART:20260901T170000Z");
    expect(ics).toContain("DTEND:20260901T173000Z");
  });

  it("leaves out a reminder that is already done", () => {
    const ics = feed({
      reminders: [
        {
          id: "reminder-1",
          text: "Feed the cat",
          dueAt: "2026-09-01T17:00:00.000Z",
          completedAt: "2026-08-30T10:00:00.000Z",
          people: [],
        },
      ],
    });
    expect(ics).not.toContain("Feed the cat");
  });

  it("escapes the characters that would otherwise end a property early", () => {
    const ics = feed({
      reminders: [
        {
          id: "reminder-1",
          text: "Ask about the move; the new place, and the cat",
          dueAt: "2026-09-01T17:00:00.000Z",
          completedAt: null,
          people: [],
        },
      ],
    });
    expect(ics).toContain(
      "SUMMARY:Ask about the move\\; the new place\\, and the cat",
    );
  });

  it("never folds a line past 75 octets, counting bytes not characters", () => {
    const ics = feed({
      reminders: [
        {
          id: "reminder-1",
          text: `Café ${"long ".repeat(30)}`.trim(),
          dueAt: "2026-09-01T17:00:00.000Z",
          completedAt: null,
          people: [],
        },
      ],
    });
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    // Unfolding it again has to give the summary back intact.
    const unfolded = ics.replace(/\r\n /g, "");
    expect(unfolded).toContain("SUMMARY:Café long");
  });
});
