import { describe, expect, it } from "vitest";
import { dueDateLabelFromDaysAway } from "@/lib/relative-time";
import {
  getContactReminderState,
  getEffectiveReminderInterval,
} from "@/lib/reminders";

describe("contact reminders", () => {
  const activePerson = {
    relationshipStrength: 3 as const,
    reminderIntervalDays: null,
    remindersEnabled: true,
    status: "active" as const,
    firstMetAt: "2026-01-01T12:00:00.000Z",
    lastInteractionAt: "2026-06-01T12:00:00.000Z",
  };

  it("uses the relationship default when a person has no custom interval", () => {
    expect(getEffectiveReminderInterval(activePerson)).toBe(30);
  });

  it("prefers a person-specific reminder interval", () => {
    expect(
      getEffectiveReminderInterval({
        relationshipStrength: 3,
        reminderIntervalDays: 12,
      }),
    ).toBe(12);
  });

  it("marks a person overdue only after the due date", () => {
    const dueDateState = getContactReminderState(
      activePerson,
      new Date("2026-07-01T18:00:00.000Z"),
    );
    const overdueState = getContactReminderState(
      activePerson,
      new Date("2026-07-02T18:00:00.000Z"),
    );

    expect(dueDateState?.isOverdue).toBe(false);
    expect(overdueState).toMatchObject({ isOverdue: true, overdueDays: 1 });
  });

  it("never schedules muted or archived people", () => {
    expect(
      getContactReminderState(
        { ...activePerson, status: "muted" },
        new Date("2027-01-01T00:00:00.000Z"),
      ),
    ).toBeNull();
    expect(
      getContactReminderState(
        { ...activePerson, status: "archived" },
        new Date("2027-01-01T00:00:00.000Z"),
      ),
    ).toBeNull();
  });

  it("pauses reminders for a person who switched them off", () => {
    expect(
      getContactReminderState(
        { ...activePerson, remindersEnabled: false },
        new Date("2027-01-01T00:00:00.000Z"),
      ),
    ).toBeNull();
  });

  it("formats overdue durations without guilt language", () => {
    // The overdue chip reads through `dueDateLabelFromDaysAway` now, so that a
    // people row and a reminder say the same thing about the same day rather
    // than "9 days overdue" in one place and "Due in 9 days · Aug 26" in the
    // other. Its own tests live in relative-time.test.ts.
    expect(dueDateLabelFromDaysAway(0)).toBe("Due today");
    expect(dueDateLabelFromDaysAway(-1)).toContain("1 day overdue");
    expect(dueDateLabelFromDaysAway(-9)).toContain("9 days overdue");
  });
});
