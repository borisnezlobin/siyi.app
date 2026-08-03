import { describe, expect, it } from "vitest";
import {
  formatOverdueDuration,
  getContactReminderState,
  getEffectiveReminderInterval,
} from "@/lib/reminders";

describe("contact reminders", () => {
  const activePerson = {
    relationshipStrength: 3 as const,
    reminderIntervalDays: null,
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

  it("formats overdue durations without guilt language", () => {
    expect(formatOverdueDuration(0)).toBe("Due today");
    expect(formatOverdueDuration(1)).toBe("1 day overdue");
    expect(formatOverdueDuration(9)).toBe("9 days overdue");
  });
});
