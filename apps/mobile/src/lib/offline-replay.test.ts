import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  enqueueOfflineMutation,
  getOfflineQueue,
  removeOfflineMutation,
} from "@/lib/offline-store";
import {
  isQueuedUpdateMutation,
  replayQueuedUpdateMutation,
  type StoredInteractionRow,
  type StoredUpdateRow,
  type UpdateWriteClient,
} from "@/lib/update-writes";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    jest.requireActual(
      "@react-native-async-storage/async-storage/jest/async-storage-mock",
    ),
);
jest.mock(
  "@react-native-community/netinfo",
  () => jest.requireActual("@react-native-community/netinfo/jest/netinfo-mock"),
);

const userId = "00000000-0000-4000-8000-000000000001";
const updateId = "00000000-0000-4000-8000-000000000020";
const interactionId = "00000000-0000-4000-8000-000000000021";

function fakeServer() {
  const calls: string[] = [];
  let update: StoredUpdateRow | null = {
    id: updateId,
    isInteraction: true,
    text: "Caught up over coffee",
    updatedAt: "2026-08-01T10:00:00.000Z",
  };
  let interaction: StoredInteractionRow | null = {
    id: interactionId,
    sourceUpdateId: null,
    note: "Walked back from the library",
    updatedAt: "2026-08-01T10:00:00.000Z",
  };

  const client: UpdateWriteClient = {
    loadUpdate: async () => update,
    writeLinkedInteractions: async () => {
      calls.push("writeLinkedInteractions");
    },
    writeUpdate: async (_id, fields) => {
      calls.push("writeUpdate");
      if (update) update = { ...update, text: fields.text };
    },
    deleteLinkedInteractions: async () => {
      calls.push("deleteLinkedInteractions");
    },
    deleteUpdate: async () => {
      calls.push("deleteUpdate");
      update = null;
    },
    loadInteraction: async () => interaction,
    writeInteraction: async () => {
      calls.push("writeInteraction");
    },
    deleteInteraction: async () => {
      calls.push("deleteInteraction");
      interaction = null;
    },
  };

  return {
    calls,
    client,
    get update() {
      return update;
    },
    get interaction() {
      return interaction;
    },
  };
}

async function drainQueue(client: UpdateWriteClient) {
  const outcomes: string[] = [];
  for (const mutation of await getOfflineQueue(userId)) {
    if (!isQueuedUpdateMutation(mutation)) continue;
    outcomes.push(await replayQueuedUpdateMutation(client, mutation));
    await removeOfflineMutation(userId, mutation.id);
  }
  return outcomes;
}

describe("replaying edits and deletes made offline", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("sends a queued edit and a queued delete once the phone is back online", async () => {
    await enqueueOfflineMutation({
      id: "00000000-0000-4000-8000-000000000030",
      kind: "edit-person-update",
      userId,
      createdAt: "2026-08-02T09:00:00.000Z",
      updateId,
      baseUpdatedAt: "2026-08-01T10:00:00.000Z",
      input: {
        text: "Caught up over coffee before class",
        recordedAt: "2026-08-01T12:00:00.000Z",
        type: "coffee",
        customLabel: null,
        customIcon: null,
      },
    });
    await enqueueOfflineMutation({
      id: "00000000-0000-4000-8000-000000000031",
      kind: "delete-interaction",
      userId,
      createdAt: "2026-08-02T09:01:00.000Z",
      interactionId,
    });

    const server = fakeServer();
    const outcomes = await drainQueue(server.client);

    expect(outcomes).toEqual(["written", "deleted"]);
    expect(server.calls).toEqual([
      "writeLinkedInteractions",
      "writeUpdate",
      "deleteInteraction",
    ]);
    expect(server.update?.text).toBe("Caught up over coffee before class");
    expect(server.interaction).toBeNull();
    expect(await getOfflineQueue(userId)).toEqual([]);
  });

  it("keeps both versions when the row moved on while the phone was away", async () => {
    await enqueueOfflineMutation({
      id: "00000000-0000-4000-8000-000000000032",
      kind: "edit-person-update",
      userId,
      createdAt: "2026-08-02T09:00:00.000Z",
      updateId,
      baseUpdatedAt: "2026-07-01T10:00:00.000Z",
      input: {
        text: "Also lent her the camera",
        recordedAt: "2026-08-01T12:00:00.000Z",
        type: "coffee",
        customLabel: null,
        customIcon: null,
      },
    });

    const server = fakeServer();
    const outcomes = await drainQueue(server.client);

    expect(outcomes).toEqual(["merged"]);
    expect(server.update?.text).toContain("Caught up over coffee");
    expect(server.update?.text).toContain("Also lent her the camera");
  });

  it("removes the update's interactions before the update itself", async () => {
    await enqueueOfflineMutation({
      id: "00000000-0000-4000-8000-000000000033",
      kind: "delete-person-update",
      userId,
      createdAt: "2026-08-02T09:00:00.000Z",
      updateId,
    });

    const server = fakeServer();
    const outcomes = await drainQueue(server.client);

    expect(outcomes).toEqual(["deleted"]);
    expect(server.calls).toEqual(["deleteLinkedInteractions", "deleteUpdate"]);
    expect(server.update).toBeNull();
  });
});
