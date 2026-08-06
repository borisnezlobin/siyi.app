import { describe, expect, it } from "vitest";
import {
  buildPersonTimeline,
  lastContactAt,
} from "@/lib/person-timeline";
import { getContactReminderState } from "@/lib/reminders";
import type { Interaction, Person, PersonUpdate } from "@/lib/types";

const personId = "20000000-0000-4000-8000-000000000001";

function interaction(overrides: Partial<Interaction>): Interaction {
  return {
    id: "interaction-1",
    personId,
    userId: "user-1",
    type: "coffee",
    occurredAt: "2026-05-01T12:00:00.000Z",
    note: "Oat cortado and thrift maps.",
    customLabel: null,
    customIcon: null,
    sourceUpdateId: null,
    createdAt: "2026-05-01T12:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
    ...overrides,
  };
}

function update(overrides: Partial<PersonUpdate>): PersonUpdate {
  return {
    id: "update-1",
    userId: "user-1",
    text: "Is interested in photography",
    recordedAt: "2026-05-03T12:00:00.000Z",
    isInteraction: false,
    interactionLabel: null,
    createdAt: "2026-05-03T12:00:00.000Z",
    updatedAt: "2026-05-03T12:00:00.000Z",
    personIds: [personId],
    ...overrides,
  };
}

describe("the profile timeline", () => {
  it("keeps rows saved before updates and interactions were told apart", () => {
    // Written by the old composer: an update that also counted as contact.
    const legacy = update({
      id: "legacy-1",
      isInteraction: true,
      interactionLabel: "Coffee",
      text: "Caught up before her critique.",
      recordedAt: "2026-04-20T12:00:00.000Z",
    });

    const [entry] = buildPersonTimeline([legacy], []);

    expect(entry.title).toBe("Coffee");
    expect(entry.body).toBe("Caught up before her critique.");
    expect(entry.countsAsContact).toBe(true);
    expect(entry.editable).toMatchObject({
      kind: "update",
      id: "legacy-1",
      type: "coffee",
    });
  });

  it("titles a plain update without borrowing interaction words", () => {
    const [entry] = buildPersonTimeline([update({})], []);

    expect(entry.title).toBe("Update");
    expect(entry.countsAsContact).toBe(false);
  });

  it("shows an interaction created from an update only once", () => {
    const linked = update({
      id: "linked-1",
      isInteraction: true,
      interactionLabel: "Meal",
    });
    const timeline = buildPersonTimeline(
      [linked],
      [interaction({ id: "shadow-1", sourceUpdateId: "linked-1" })],
    );

    expect(timeline).toHaveLength(1);
    expect(timeline[0].id).toBe("update-linked-1");
  });

  it("orders everything by when it happened, newest first", () => {
    const timeline = buildPersonTimeline(
      [update({ id: "u", recordedAt: "2026-05-03T12:00:00.000Z" })],
      [
        interaction({ id: "old", occurredAt: "2026-01-01T12:00:00.000Z" }),
        interaction({ id: "new", occurredAt: "2026-06-01T12:00:00.000Z" }),
      ],
    );

    expect(timeline.map((entry) => entry.id)).toEqual([
      "interaction-new",
      "update-u",
      "interaction-old",
    ]);
  });

  it("keeps the long-form wording the profile has always used", () => {
    const [entry] = buildPersonTimeline([], [interaction({ type: "meal" })]);
    expect(entry.title).toBe("Shared a meal");
  });
});

describe("what a reminder is measured from", () => {
  const person: Pick<
    Person,
    | "relationshipStrength"
    | "reminderIntervalDays"
    | "remindersEnabled"
    | "status"
    | "firstMetAt"
    | "lastInteractionAt"
  > = {
    relationshipStrength: 3,
    reminderIntervalDays: 30,
    remindersEnabled: true,
    status: "active",
    firstMetAt: "2026-01-01T12:00:00.000Z",
    lastInteractionAt: "2026-05-01T12:00:00.000Z",
  };

  const now = new Date("2026-05-10T12:00:00.000Z");

  it("does not move when an update is added", () => {
    const interactions = [interaction({})];
    const before = getContactReminderState(
      { ...person, lastInteractionAt: lastContactAt(interactions) },
      now,
    );
    const timelineBefore = buildPersonTimeline([], interactions);

    // Saving an update writes no interaction row at all, so the only thing
    // that changes is what the profile shows.
    const learned = update({ id: "learned", recordedAt: now.toISOString() });
    const timelineAfter = buildPersonTimeline([learned], interactions);
    const after = getContactReminderState(
      { ...person, lastInteractionAt: lastContactAt(interactions) },
      now,
    );

    expect(timelineAfter.length).toBe(timelineBefore.length + 1);
    expect(after?.dueAt.toISOString()).toBe(before?.dueAt.toISOString());
    expect(lastContactAt(interactions)).toBe("2026-05-01T12:00:00.000Z");
  });

  it("moves only when a new interaction is logged", () => {
    const before = lastContactAt([interaction({})]);
    const after = lastContactAt([
      interaction({}),
      interaction({ id: "later", occurredAt: "2026-05-08T12:00:00.000Z" }),
    ]);

    expect(before).toBe("2026-05-01T12:00:00.000Z");
    expect(after).toBe("2026-05-08T12:00:00.000Z");
  });

  it("still reads an interaction an old update created", () => {
    const linkedToUpdate = interaction({
      id: "from-update",
      occurredAt: "2026-05-06T12:00:00.000Z",
      sourceUpdateId: "legacy-1",
    });

    expect(lastContactAt([interaction({}), linkedToUpdate])).toBe(
      "2026-05-06T12:00:00.000Z",
    );
  });
});
