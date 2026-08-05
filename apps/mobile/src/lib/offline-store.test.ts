import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  enqueueOfflineMutation,
  getOfflineQueue,
  getOfflineSnapshot,
  removeOfflineMutation,
  updateOfflineSnapshot,
} from "@/lib/offline-store";

jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    jest.requireActual(
      "@react-native-async-storage/async-storage/jest/async-storage-mock",
    ),
);
jest.mock(
  "@react-native-community/netinfo",
  () =>
    jest.requireActual("@react-native-community/netinfo/jest/netinfo-mock"),
);

const firstUser = "00000000-0000-4000-8000-000000000001";
const secondUser = "00000000-0000-4000-8000-000000000002";

describe("offline store", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("keeps cached account data isolated by user", async () => {
    await updateOfflineSnapshot(firstUser, (snapshot) => ({
      ...snapshot,
      recentUpdateTypes: ["Coffee"],
    }));

    expect((await getOfflineSnapshot(firstUser)).recentUpdateTypes).toEqual([
      "Coffee",
    ]);
    expect((await getOfflineSnapshot(secondUser)).recentUpdateTypes).toEqual(
      [],
    );
  });

  it("persists mutations until a successful sync removes them", async () => {
    const mutation = {
      id: "00000000-0000-4000-8000-000000000010",
      kind: "archive-person" as const,
      userId: firstUser,
      createdAt: "2026-08-05T12:00:00.000Z",
      personId: "00000000-0000-4000-8000-000000000011",
    };

    await enqueueOfflineMutation(mutation);
    await enqueueOfflineMutation(mutation);
    expect(await getOfflineQueue(firstUser)).toEqual([mutation]);

    await removeOfflineMutation(firstUser, mutation.id);
    expect(await getOfflineQueue(firstUser)).toEqual([]);
  });
});
