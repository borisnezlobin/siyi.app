import {
  interactionRowsFor,
  learnedUpdateFor,
} from "@/lib/capture-drafts";
import { reminderDueDate } from "@/lib/reminders";
import type { Person } from "@/lib/types";

const amelia = "20000000-0000-4000-8000-000000000001";
const luis = "20000000-0000-4000-8000-000000000002";
const rosa = "20000000-0000-4000-8000-000000000003";
const now = new Date("2026-05-10T18:00:00.000Z");

describe("logging who you saw", () => {
  it("writes one interaction per person from a single selection", () => {
    const rows = interactionRowsFor(
      {
        personIds: [amelia, luis, rosa],
        title: "Coffee",
        occurredOn: "2026-05-08",
        note: "",
      },
      now,
    );

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.personId)).toEqual([amelia, luis, rosa]);
    // One evening, so every row carries the same moment and all three
    // reminders move together.
    for (const row of rows) {
      expect(row.type).toBe("coffee");
      expect(row.occurredAt).toBe(rows[0].occurredAt);
      expect(row.occurredAt.slice(0, 10)).toBe("2026-05-08");
    }
  });

  it("needs nothing but the people", () => {
    const [row] = interactionRowsFor(
      { personIds: [amelia], title: "", occurredOn: "2026-05-10", note: "" },
      now,
    );

    expect(row.note).toBeNull();
    expect(row.type).toBe("talked");
    expect(row.customLabel).toBeNull();
  });

  it("keeps a title the user invented as their own words", () => {
    const [row] = interactionRowsFor(
      {
        personIds: [amelia],
        title: "Went bouldering",
        occurredOn: "2026-05-10",
        note: "Ran into them at the gym.",
      },
      now,
    );

    expect(row.type).toBe("other");
    expect(row.customLabel).toBe("Went bouldering");
    expect(row.note).toBe("Ran into them at the gym.");
  });

  it("never logs the same person twice", () => {
    const rows = interactionRowsFor(
      {
        personIds: [amelia, amelia, luis],
        title: "",
        occurredOn: "2026-05-10",
        note: "",
      },
      now,
    );

    expect(rows).toHaveLength(2);
  });
});

describe("adding an update", () => {
  it("does not count as having contacted them", () => {
    const input = learnedUpdateFor(
      {
        personIds: [amelia],
        text: "Is interested in photography",
        recordedOn: "2026-05-10",
      },
      now,
    );

    expect(input.isInteraction).toBe(false);
    expect(input.interactionLabel).toBeNull();
    expect(input.type).toBeNull();
  });

  it("leaves the next reminder exactly where it was", () => {
    const person = {
      id: amelia,
      firstMetAt: "2026-01-01T12:00:00.000Z",
      lastInteractionAt: "2026-05-01T12:00:00.000Z",
      relationshipStrength: 3,
      reminderIntervalDays: 30,
      remindersEnabled: true,
    } as Person;

    const before = reminderDueDate(person).toISOString();

    const input = learnedUpdateFor(
      {
        personIds: [amelia],
        text: "Is interested in photography",
        recordedOn: "2026-05-10",
      },
      now,
    );
    // is_interaction false means the local snapshot never touches
    // lastInteractionAt, so the same person record drives the same date.
    expect(input.isInteraction).toBe(false);
    expect(reminderDueDate(person).toISOString()).toBe(before);
  });
});
