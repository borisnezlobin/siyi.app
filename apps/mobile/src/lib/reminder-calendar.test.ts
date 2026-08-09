import {
  buildCalendarDays,
  calendarRange,
  calendarTitle,
  countOnDay,
  dayKey,
  shiftAnchor,
  startOfWeek,
  type CalendarReminder,
} from "@/lib/reminder-calendar";

// A Sunday, so week boundaries are easy to reason about.
const august9 = new Date(2026, 7, 9, 12, 0, 0);

const reminder = (id: string, dueAt: string): CalendarReminder => ({
  id,
  text: id,
  dueAt,
  person: { id: "p1", name: "Alara" },
});

const people = [
  { id: "p1", fullName: "Alara Martin", birthday: "2004-08-12" },
  { id: "p2", fullName: "Jack Spitzer", birthday: "1999-12-25" },
  { id: "p3", fullName: "No Birthday", birthday: null },
  { id: "p4", fullName: "Archived", birthday: "2004-08-12", status: "archived" },
];

describe("calendarRange", () => {
  it("covers one day", () => {
    const { start, end } = calendarRange("day", august9);
    expect(dayKey(start)).toBe("2026-08-09");
    expect(dayKey(end)).toBe("2026-08-09");
  });

  it("runs a week from Sunday to Saturday", () => {
    const { start, end } = calendarRange("week", new Date(2026, 7, 12));
    expect(dayKey(start)).toBe("2026-08-09");
    expect(dayKey(end)).toBe("2026-08-15");
  });

  it("pads a month out to whole weeks", () => {
    const { start, end } = calendarRange("month", august9);
    // August 2026 starts on a Saturday, so the grid opens the Sunday before.
    expect(dayKey(start)).toBe("2026-07-26");
    expect(start.getDay()).toBe(0);
    expect(end.getDay()).toBe(6);
  });
});

describe("buildCalendarDays", () => {
  it("puts each reminder on the day it is due", () => {
    const days = buildCalendarDays({
      scope: "week",
      anchor: august9,
      reminders: [reminder("a", new Date(2026, 7, 12, 9).toISOString())],
      people: [],
      now: august9,
    });

    const wednesday = days.find((day) => day.key === "2026-08-12");
    expect(wednesday?.reminders.map((entry) => entry.id)).toEqual(["a"]);
    expect(days.filter((day) => day.reminders.length)).toHaveLength(1);
  });

  it("orders a day's reminders by the time they are due", () => {
    const days = buildCalendarDays({
      scope: "day",
      anchor: august9,
      reminders: [
        reminder("evening", new Date(2026, 7, 9, 18).toISOString()),
        reminder("morning", new Date(2026, 7, 9, 8).toISOString()),
      ],
      people: [],
      now: august9,
    });

    expect(days[0].reminders.map((entry) => entry.id)).toEqual(["morning", "evening"]);
  });

  it("shows a birthday in whatever year the calendar is on", () => {
    const days = buildCalendarDays({
      scope: "month",
      anchor: august9,
      reminders: [],
      people,
      now: august9,
    });

    const birthday = days.find((day) => day.key === "2026-08-12");
    expect(birthday?.birthdays).toEqual([
      { personId: "p1", name: "Alara Martin", photoUrl: undefined, turning: 22 },
    ]);
  });

  it("leaves out anyone archived, or with no birthday saved", () => {
    const days = buildCalendarDays({
      scope: "month",
      anchor: august9,
      reminders: [],
      people,
      now: august9,
    });

    const all = days.flatMap((day) => day.birthdays);
    expect(all.map((entry) => entry.personId)).toEqual(["p1"]);
  });

  it("marks the days either side of the month it is showing", () => {
    const days = buildCalendarDays({
      scope: "month",
      anchor: august9,
      reminders: [],
      people: [],
      now: august9,
    });

    expect(days[0].inScope).toBe(false);
    expect(days.find((day) => day.key === "2026-08-01")?.inScope).toBe(true);
    expect(days).toHaveLength(42);
  });

  it("knows which day is today", () => {
    const days = buildCalendarDays({
      scope: "week",
      anchor: august9,
      reminders: [],
      people: [],
      now: august9,
    });

    expect(days.filter((day) => day.isToday).map((day) => day.key)).toEqual([
      "2026-08-09",
    ]);
  });

  it("ignores a reminder whose date makes no sense", () => {
    const days = buildCalendarDays({
      scope: "week",
      anchor: august9,
      reminders: [reminder("broken", "not a date")],
      people: [],
      now: august9,
    });

    expect(days.flatMap((day) => day.reminders)).toEqual([]);
  });
});

describe("shiftAnchor", () => {
  it("steps a day, a week and a month", () => {
    expect(dayKey(shiftAnchor("day", august9, 1))).toBe("2026-08-10");
    expect(dayKey(shiftAnchor("week", august9, -1))).toBe("2026-08-02");
    expect(dayKey(shiftAnchor("month", august9, 1))).toBe("2026-09-01");
  });

  it("does not skip a short month when stepping from the end of a long one", () => {
    // From 31 August, adding a month naively lands on 1 October.
    const august31 = new Date(2026, 7, 31);
    expect(dayKey(shiftAnchor("month", august31, 1))).toBe("2026-09-01");
  });
});

describe("calendarTitle", () => {
  it("names the period rather than the date", () => {
    expect(calendarTitle("month", august9)).toContain("August");
    expect(calendarTitle("month", august9)).toContain("2026");
    expect(calendarTitle("week", august9)).toContain("–");
  });
});

describe("countOnDay", () => {
  it("counts reminders and birthdays together", () => {
    const days = buildCalendarDays({
      scope: "day",
      anchor: new Date(2026, 7, 12),
      reminders: [reminder("a", new Date(2026, 7, 12, 9).toISOString())],
      people,
      now: august9,
    });

    expect(countOnDay(days[0])).toBe(2);
  });
});

describe("startOfWeek", () => {
  it("lands on Sunday whatever day it is given", () => {
    for (let offset = 0; offset < 7; offset += 1) {
      expect(startOfWeek(new Date(2026, 7, 9 + offset)).getDay()).toBe(0);
    }
  });
});
