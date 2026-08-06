import { describe, expect, it } from "vitest";
import {
  evaluateUserNotifications,
  type NotificationEvaluationInput,
} from "@/lib/notification-evaluator";

const baseInput: NotificationEvaluationInput = {
  userId: "00000000-0000-4000-8000-000000000001",
  timezone: "America/Los_Angeles",
  preferences: {
    pushEnabled: true,
    overdueContactEnabled: true,
    birthdayEnabled: true,
    followUpEnabled: true,
    reminderHourLocal: 10,
    reminderDaysOfWeek: [1, 2, 3, 4, 5],
  },
  people: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      fullName: "Maya Chen",
      preferredName: "Maya",
      birthday: "2004-08-10",
      relationshipStrength: 4,
      reminderIntervalDays: null,
      remindersEnabled: true,
      firstMetAt: "2026-01-01T18:00:00.000Z",
      lastInteractionAt: "2026-07-01T18:00:00.000Z",
    },
  ],
  followUps: [
    {
      id: "40000000-0000-4000-8000-000000000001",
      personId: "20000000-0000-4000-8000-000000000001",
      text: "Send the studio hours",
      dueAt: "2026-08-03T16:00:00.000Z",
      personName: "Maya",
    },
  ],
};

describe("evaluateUserNotifications", () => {
  const evaluationTime = new Date("2026-08-03T17:00:00.000Z");

  it("creates deterministic candidates at the user's local reminder time", () => {
    const candidates = evaluateUserNotifications(baseInput, evaluationTime);

    expect(candidates.map(({ type }) => type)).toEqual([
      "overdue_contact",
      "birthday",
      "follow_up",
    ]);
    expect(candidates[0].deduplicationKey).toBe(
      "contact:00000000-0000-4000-8000-000000000001:20000000-0000-4000-8000-000000000001:2026-07-15",
    );
    expect(candidates[2].url).toContain("/follow-ups?person=");
  });

  it("skips the overdue nudge when a person turned reminders off", () => {
    const candidates = evaluateUserNotifications(
      {
        ...baseInput,
        people: baseInput.people.map((person) => ({
          ...person,
          remindersEnabled: false,
        })),
      },
      evaluationTime,
    );

    expect(candidates.map(({ type }) => type)).toEqual([
      "birthday",
      "follow_up",
    ]);
  });

  it("does not evaluate outside the preferred local hour", () => {
    expect(
      evaluateUserNotifications(
        baseInput,
        new Date("2026-08-03T18:00:00.000Z"),
      ),
    ).toEqual([]);
  });

  it("does not evaluate when push is disabled", () => {
    expect(
      evaluateUserNotifications(
        {
          ...baseInput,
          preferences: { ...baseInput.preferences, pushEnabled: false },
        },
        evaluationTime,
      ),
    ).toEqual([]);
  });
});
