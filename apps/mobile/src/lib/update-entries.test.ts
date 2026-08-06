import {
  editableEntryFromInteraction,
  editableEntryFromUpdate,
} from "@/lib/update-entries";
import type { Interaction, PersonUpdate } from "@/lib/types";

const savedUpdate: PersonUpdate = {
  id: "update-1",
  userId: "user-1",
  text: "Caught up over coffee",
  recordedAt: "2026-08-01T12:00:00.000Z",
  isInteraction: true,
  interactionLabel: "Coffee",
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
  personIds: ["person-1"],
};

const savedInteraction: Interaction = {
  id: "interaction-1",
  personId: "person-1",
  userId: "user-1",
  type: "coffee",
  occurredAt: "2026-08-01T12:00:00.000Z",
  note: "Caught up over coffee",
  customLabel: null,
  customIcon: null,
  createdAt: "2026-08-01T12:00:00.000Z",
  updatedAt: "2026-08-01T12:00:00.000Z",
  sourceUpdateId: "update-1",
};

describe("opening a timeline entry for editing", () => {
  it("works an update's type back from the label it was saved with", () => {
    expect(editableEntryFromUpdate(savedUpdate).type).toBe("coffee");
  });

  it("treats a label the app never offered as the user's own name for it", () => {
    const entry = editableEntryFromUpdate({
      ...savedUpdate,
      interactionLabel: "Went bouldering",
    });

    expect(entry.type).toBe("other");
    expect(entry.customLabel).toBe("Went bouldering");
  });

  it("prefers the words and icon stored on the linked interaction", () => {
    const entry = editableEntryFromUpdate(
      { ...savedUpdate, interactionLabel: "Went bouldering" },
      {
        ...savedInteraction,
        type: "other",
        customLabel: "Bouldering session",
        customIcon: "climb",
      },
    );

    expect(entry.customLabel).toBe("Bouldering session");
    expect(entry.customIcon).toBe("climb");
  });

  it("keeps an update that was never an interaction out of the type picker", () => {
    const entry = editableEntryFromUpdate({
      ...savedUpdate,
      isInteraction: false,
      interactionLabel: null,
    });

    expect(entry.type).toBe("other");
    expect(entry.customLabel).toBeNull();
  });

  it("refuses an interaction that an update owns", () => {
    expect(editableEntryFromInteraction(savedInteraction)).toBeNull();
  });

  it("opens an interaction that stands on its own", () => {
    const entry = editableEntryFromInteraction({
      ...savedInteraction,
      sourceUpdateId: null,
    });

    expect(entry).not.toBeNull();
    expect(entry?.kind).toBe("interaction");
    expect(entry?.body).toBe("Caught up over coffee");
  });
});
