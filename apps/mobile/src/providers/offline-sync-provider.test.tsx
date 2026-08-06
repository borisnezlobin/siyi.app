import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { OfflineSyncProvider } from "@/providers/offline-sync-provider";

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { addEventListener: () => () => undefined },
}));

jest.mock("expo-router", () => ({
  useFocusEffect: () => undefined,
}));

jest.mock("@/lib/data", () => ({
  flushOfflineMutations: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/offline-store", () => ({
  pendingOfflineMutationCount: jest.fn().mockResolvedValue(1),
  subscribeToOfflineStore: () => () => undefined,
}));

jest.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } } }),
}));

import { flushOfflineMutations } from "@/lib/data";

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderProvider() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <OfflineSyncProvider>{null}</OfflineSyncProvider>
    </SafeAreaProvider>,
  );
  // The pending count is read asynchronously on mount.
  await act(async () => {});
}

describe("the change that has not saved", () => {
  it("says plainly what happened and how to fix it", async () => {
    await renderProvider();

    expect(
      screen.getByText("1 change has not saved yet. Tap to try again."),
    ).toBeTruthy();
  });

  it("waits for a tap instead of disappearing on its own", async () => {
    jest.useFakeTimers();
    await renderProvider();
    await act(async () => {
      jest.advanceTimersByTime(30000);
    });

    expect(
      screen.getByText("1 change has not saved yet. Tap to try again."),
    ).toBeTruthy();
    jest.useRealTimers();
  });

  it("retries when tapped and goes away when dismissed", async () => {
    await renderProvider();
    await fireEvent.press(
      screen.getByText("1 change has not saved yet. Tap to try again."),
    );

    expect(flushOfflineMutations).toHaveBeenCalledWith("user-1");

    await fireEvent.press(screen.getByLabelText("Dismiss"));

    expect(
      screen.queryByText("1 change has not saved yet. Tap to try again."),
    ).toBeNull();
  });
});
