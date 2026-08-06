import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "expo-router";
import { CloudArrowUp, WarningCircle, WifiSlash, X } from "phosphor-react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/app-text";
import { colors, floatShadow, radii } from "@/constants/theme";
import { flushOfflineMutations } from "@/lib/data";
import {
  pendingOfflineMutationCount,
  subscribeToOfflineStore,
} from "@/lib/offline-store";
import { useAuth } from "@/providers/auth-provider";

type OfflineSyncContextValue = {
  online: boolean;
  pendingCount: number;
  syncing: boolean;
  syncNow: () => Promise<void>;
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [online, setOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    setPendingCount(
      session
        ? await pendingOfflineMutationCount(session.user.id)
        : 0,
    );
  }, [session]);

  const syncNow = useCallback(async () => {
    if (!session) return;
    setSyncing(true);
    try {
      await flushOfflineMutations(session.user.id);
      await refreshPendingCount();
    } finally {
      setSyncing(false);
    }
  }, [refreshPendingCount, session]);

  useEffect(() => {
    void refreshPendingCount();
    return subscribeToOfflineStore(() => {
      void refreshPendingCount();
    });
  }, [refreshPendingCount]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const nextOnline = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );
      setOnline(nextOnline);
      if (nextOnline) void syncNow();
    });
    return unsubscribe;
  }, [syncNow]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncNow();
    });
    return () => subscription.remove();
  }, [syncNow]);

  useFocusEffect(
    useCallback(() => {
      void refreshPendingCount();
    }, [refreshPendingCount]),
  );

  const value = useMemo(
    () => ({ online, pendingCount, syncing, syncNow }),
    [online, pendingCount, syncing, syncNow],
  );

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
      <OfflineStatus />
    </OfflineSyncContext.Provider>
  );
}

// Long enough to finish reading before it goes. A message that flashes for
// half a second may as well not have been shown.
const minimumVisibleMilliseconds = 5000;

function OfflineStatus() {
  const insets = useSafeAreaInsets();
  const context = useContext(OfflineSyncContext);
  const [dismissed, setDismissed] = useState(false);
  const online = context?.online ?? true;
  const pendingCount = context?.pendingCount ?? 0;
  const syncing = context?.syncing ?? false;
  const active = !online || pendingCount > 0;
  // Retries that keep failing are the one thing worth interrupting for, so
  // that message waits for a tap instead of a timer.
  const needsAttention = online && !syncing && pendingCount > 0;
  const [lingering, setLingering] = useState(false);

  useEffect(() => {
    if (active) {
      setDismissed(false);
      setLingering(true);
      return;
    }
    if (!lingering) return;
    const timer = setTimeout(
      () => setLingering(false),
      minimumVisibleMilliseconds,
    );
    return () => clearTimeout(timer);
  }, [active, lingering]);

  if (!context) return null;
  if (dismissed) return null;
  if (!active && !lingering) return null;

  const Icon = !online
    ? WifiSlash
    : syncing || !active
      ? CloudArrowUp
      : WarningCircle;
  const changes = `${pendingCount} ${pendingCount === 1 ? "change" : "changes"}`;
  const message = !online
    ? pendingCount > 0
      ? `Offline. ${changes} saved on this phone, and will go up when you are back.`
      : "Offline. Showing the people saved on this phone."
    : !active
      ? "Saved and synced."
      : syncing
        ? `Saving ${changes}…`
        : `${changes} ${pendingCount === 1 ? "has" : "have"} not saved yet. Tap to try again.`;

  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents={needsAttention ? "box-none" : "none"}
      style={[styles.position, { top: insets.top + 8 }]}
    >
      <Pressable
        accessibilityHint={
          needsAttention ? "Retries the changes waiting to save" : undefined
        }
        accessibilityRole={needsAttention ? "button" : undefined}
        disabled={!needsAttention}
        onPress={() => void context.syncNow()}
        style={styles.pill}
      >
        <Icon color={colors.paper} size={16} weight="bold" />
        <AppText style={styles.text} variant="caption">
          {message}
        </AppText>
        {needsAttention ? (
          <Pressable
            accessibilityLabel="Dismiss"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setDismissed(true)}
          >
            <X color={colors.paper} size={15} weight="bold" />
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

export function useOfflineSync() {
  const context = useContext(OfflineSyncContext);
  if (!context) {
    throw new Error(
      "useOfflineSync must be used inside OfflineSyncProvider.",
    );
  }
  return context;
}

const styles = StyleSheet.create({
  pill: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radii.small,
    flexDirection: "row",
    gap: 9,
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 7,
    ...floatShadow,
  },
  position: {
    alignItems: "center",
    left: 20,
    position: "absolute",
    right: 20,
    zIndex: 100,
  },
  text: {
    color: colors.paper,
    flexShrink: 1,
  },
});
