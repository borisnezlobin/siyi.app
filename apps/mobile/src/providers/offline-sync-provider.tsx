import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "expo-router";
import { CloudArrowUp, WarningCircle, WifiSlash } from "phosphor-react-native";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState, StyleSheet, View } from "react-native";
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

function OfflineStatus() {
  const insets = useSafeAreaInsets();
  const context = useContext(OfflineSyncContext);
  if (!context) return null;
  if (context.online && context.pendingCount === 0) return null;

  const Icon = context.online
    ? context.syncing
      ? CloudArrowUp
      : WarningCircle
    : WifiSlash;
  const message = context.online
    ? context.syncing
      ? `Syncing ${context.pendingCount} ${context.pendingCount === 1 ? "change" : "changes"}`
      : `${context.pendingCount} ${context.pendingCount === 1 ? "change needs" : "changes need"} another try`
    : context.pendingCount > 0
      ? `${context.pendingCount} ${context.pendingCount === 1 ? "change is" : "changes are"} saved on this phone`
      : "Offline · showing saved people";

  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[styles.position, { top: insets.top + 8 }]}
    >
      <View style={styles.pill}>
        <Icon color={colors.paper} size={16} weight="bold" />
        <AppText style={styles.text} variant="caption">
          {message}
        </AppText>
      </View>
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
    gap: 7,
    minHeight: 34,
    paddingHorizontal: 12,
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
  },
});
