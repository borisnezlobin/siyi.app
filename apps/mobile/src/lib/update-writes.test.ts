import {
  applyInteractionDelete,
  applyInteractionEdit,
  applyPersonUpdateDelete,
  applyPersonUpdateEdit,
  mergeKeepingBoth,
  type StoredInteractionRow,
  type StoredUpdateRow,
  type UpdateWriteClient,
} from "@/lib/update-writes";

function recordingClient(rows: {
  update?: StoredUpdateRow | null;
  interaction?: StoredInteractionRow | null;
}) {
  const calls: string[] = [];
  const writes: Record<string, unknown> = {};
  const client: UpdateWriteClient = {
    loadUpdate: async () => rows.update ?? null,
    writeLinkedInteractions: async (updateId, fields) => {
      calls.push("writeLinkedInteractions");
      writes.linkedInteractions = { updateId, fields };
    },
    writeUpdate: async (updateId, fields) => {
      calls.push("writeUpdate");
      writes.update = { updateId, fields };
    },
    deleteLinkedInteractions: async () => {
      calls.push("deleteLinkedInteractions");
    },
    deleteUpdate: async () => {
      calls.push("deleteUpdate");
    },
    loadInteraction: async () => rows.interaction ?? null,
    writeInteraction: async (interactionId, fields) => {
      calls.push("writeInteraction");
      writes.interaction = { interactionId, fields };
    },
    deleteInteraction: async () => {
      calls.push("deleteInteraction");
    },
  };
  return { calls, client, writes };
}

const savedUpdate: StoredUpdateRow = {
  id: "update-1",
  isInteraction: true,
  text: "Caught up over coffee",
  updatedAt: "2026-08-01T10:00:00.000Z",
};

const edit = {
  text: "Caught up over coffee before class",
  recordedAt: "2026-08-01T12:00:00.000Z",
  type: "coffee" as const,
  customLabel: null,
  customIcon: null,
};

describe("editing an update", () => {
  it("writes the linked interactions before the update itself", async () => {
    const { calls, client } = recordingClient({ update: savedUpdate });

    const outcome = await applyPersonUpdateEdit(client, {
      updateId: "update-1",
      baseUpdatedAt: savedUpdate.updatedAt,
      edit,
    });

    expect(outcome).toBe("written");
    expect(calls).toEqual(["writeLinkedInteractions", "writeUpdate"]);
  });

  it("leaves interactions alone for an update that was never one", async () => {
    const { calls, client } = recordingClient({
      update: { ...savedUpdate, isInteraction: false },
    });

    await applyPersonUpdateEdit(client, {
      updateId: "update-1",
      baseUpdatedAt: savedUpdate.updatedAt,
      edit,
    });

    expect(calls).toEqual(["writeUpdate"]);
  });

  it("names an Other update with the user's own words", async () => {
    const { client, writes } = recordingClient({ update: savedUpdate });

    await applyPersonUpdateEdit(client, {
      updateId: "update-1",
      baseUpdatedAt: savedUpdate.updatedAt,
      edit: {
        ...edit,
        type: "other",
        customLabel: "Went bouldering",
        customIcon: "climb",
      },
    });

    expect(
      (writes.update as { fields: { interactionLabel?: string } }).fields
        .interactionLabel,
    ).toBe("Went bouldering");
  });

  it("does nothing when the update has already been deleted elsewhere", async () => {
    const { calls, client } = recordingClient({ update: null });

    const outcome = await applyPersonUpdateEdit(client, {
      updateId: "update-1",
      baseUpdatedAt: savedUpdate.updatedAt,
      edit,
    });

    expect(outcome).toBe("gone");
    expect(calls).toEqual([]);
  });

  it("keeps both versions when the row changed underneath the queued edit", async () => {
    const { client, writes } = recordingClient({
      update: { ...savedUpdate, updatedAt: "2026-08-02T09:00:00.000Z" },
    });

    const outcome = await applyPersonUpdateEdit(client, {
      updateId: "update-1",
      baseUpdatedAt: "2026-08-01T10:00:00.000Z",
      edit,
    });

    expect(outcome).toBe("merged");
    const written = (writes.update as { fields: { text: string } }).fields.text;
    expect(written).toContain("Caught up over coffee");
    expect(written).toContain("Caught up over coffee before class");
  });

  it("is safe to run twice after a write that was never acknowledged", async () => {
    const merged = mergeKeepingBoth(savedUpdate.text, edit.text);

    expect(mergeKeepingBoth(merged, edit.text)).toBe(merged);
  });
});

describe("deleting an update", () => {
  it("removes the linked interactions before the update, so none reappear", async () => {
    const { calls, client } = recordingClient({ update: savedUpdate });

    const outcome = await applyPersonUpdateDelete(client, "update-1");

    expect(outcome).toBe("deleted");
    expect(calls).toEqual(["deleteLinkedInteractions", "deleteUpdate"]);
  });

  it("can be run again without complaining", async () => {
    const { calls, client } = recordingClient({ update: null });

    await applyPersonUpdateDelete(client, "update-1");
    await applyPersonUpdateDelete(client, "update-1");

    expect(calls).toEqual([
      "deleteLinkedInteractions",
      "deleteUpdate",
      "deleteLinkedInteractions",
      "deleteUpdate",
    ]);
  });
});

const standaloneInteraction: StoredInteractionRow = {
  id: "interaction-1",
  sourceUpdateId: null,
  note: "Walked back from the library",
  updatedAt: "2026-08-01T10:00:00.000Z",
};

const interactionEdit = {
  type: "met" as const,
  occurredAt: "2026-08-01T12:00:00.000Z",
  note: "Walked back from the library together",
  customLabel: null,
  customIcon: null,
};

describe("editing a standalone interaction", () => {
  it("saves it", async () => {
    const { calls, client } = recordingClient({
      interaction: standaloneInteraction,
    });

    const outcome = await applyInteractionEdit(client, {
      interactionId: "interaction-1",
      baseUpdatedAt: standaloneInteraction.updatedAt,
      edit: interactionEdit,
    });

    expect(outcome).toBe("written");
    expect(calls).toEqual(["writeInteraction"]);
  });

  it("refuses an interaction that belongs to an update", async () => {
    const { calls, client } = recordingClient({
      interaction: { ...standaloneInteraction, sourceUpdateId: "update-1" },
    });

    const outcome = await applyInteractionEdit(client, {
      interactionId: "interaction-1",
      baseUpdatedAt: standaloneInteraction.updatedAt,
      edit: interactionEdit,
    });

    expect(outcome).toBe("owned-by-update");
    expect(calls).toEqual([]);
  });

  it("refuses to delete an interaction that belongs to an update", async () => {
    const { calls, client } = recordingClient({
      interaction: { ...standaloneInteraction, sourceUpdateId: "update-1" },
    });

    const outcome = await applyInteractionDelete(client, "interaction-1");

    expect(outcome).toBe("owned-by-update");
    expect(calls).toEqual([]);
  });

  it("keeps both notes when the row changed underneath the queued edit", async () => {
    const { client, writes } = recordingClient({
      interaction: {
        ...standaloneInteraction,
        note: "Walked back from the library, she starts her thesis Monday",
        updatedAt: "2026-08-02T09:00:00.000Z",
      },
    });

    const outcome = await applyInteractionEdit(client, {
      interactionId: "interaction-1",
      baseUpdatedAt: "2026-08-01T10:00:00.000Z",
      edit: interactionEdit,
    });

    expect(outcome).toBe("merged");
    const written = (writes.interaction as { fields: { note: string } }).fields
      .note;
    expect(written).toContain("starts her thesis Monday");
    expect(written).toContain("Walked back from the library together");
  });

  it("deletes one that stands on its own", async () => {
    const { calls, client } = recordingClient({
      interaction: standaloneInteraction,
    });

    const outcome = await applyInteractionDelete(client, "interaction-1");

    expect(outcome).toBe("deleted");
    expect(calls).toEqual(["deleteInteraction"]);
  });
});
