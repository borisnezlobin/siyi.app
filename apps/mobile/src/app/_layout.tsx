import "react-native-gesture-handler";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Manrope_400Regular } from "@expo-google-fonts/manrope/400Regular";
import { Manrope_600SemiBold } from "@expo-google-fonts/manrope/600SemiBold";
import { Manrope_700Bold } from "@expo-google-fonts/manrope/700Bold";
import { Newsreader_500Medium } from "@expo-google-fonts/newsreader/500Medium";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useRouter } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import type { ErrorBoundaryProps } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ContactSyncOverlay } from "@/components/contact-sync-overlay";
import { colors } from "@/constants/theme";
import { startCacheInvalidation } from "@/lib/cache-invalidation";
import { SharedElementProvider } from "@/components/shared-element";
import { AuthProvider } from "@/providers/auth-provider";
import { useAuth } from "@/providers/auth-provider";
import { OfflineSyncProvider } from "@/providers/offline-sync-provider";
import {
  appRouteFromNotificationUrl,
  configureNotificationPresentation,
  refreshExistingPushRegistration,
} from "@/lib/native-push";

void SplashScreen.preventAutoHideAsync();

// Module scope on purpose: the listener has to outlive any one screen, which
// is the whole reason the cache it guards is worth having.
startCacheInvalidation();
configureNotificationPresentation();

function AppRuntime() {
  const router = useRouter();
  const { session } = useAuth();

  useEffect(() => {
    if (!session || Platform.OS === "web") return;
    void refreshExistingPushRegistration(session).catch(() => undefined);
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      void refreshExistingPushRegistration(session).catch(() => undefined);
    });
    return () => tokenSubscription.remove();
  }, [session]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    function openResponse(response: Notifications.NotificationResponse | null) {
      if (!response) return;
      const route = appRouteFromNotificationUrl(
        response.notification.request.content.data?.url,
      );
      router.push(route);
    }

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener(openResponse);
    void Notifications.getLastNotificationResponseAsync().then(openResponse);
    return () => responseSubscription.remove();
  }, [router]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          animation: "fade_from_bottom",
          contentStyle: { backgroundColor: colors.porcelain },
          headerShown: false,
        }}
      />
      <ContactSyncOverlay />
    </>
  );
}

/**
 * The last thing between a render that threw and a shut app.
 *
 * Deliberately built from plain Text and the system font: this has to draw
 * when the fonts are what failed, and it sits above every provider, so it can
 * assume none of them mounted.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={errorStyles.screen}>
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.body}>
        Nothing you saved has been lost. Try again, and if it keeps happening,
        write to us and we will look into it.
      </Text>
      <Text style={errorStyles.detail}>{error.message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={errorStyles.action}
      >
        <Text style={errorStyles.actionLabel}>Try again</Text>
      </Pressable>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  screen: {
    backgroundColor: colors.porcelain,
    flex: 1,
    gap: 14,
    justifyContent: "center",
    padding: 28,
  },
  title: {
    color: colors.ink,
    fontSize: 26,
  },
  body: {
    color: colors.inkMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  detail: {
    color: colors.inkMuted,
    fontSize: 13,
  },
  action: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.coral,
    borderRadius: 14,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  actionLabel: {
    color: colors.paper,
    fontSize: 15,
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Manrope_400Regular,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Newsreader_500Medium,
  });
  const fontsReady = fontsLoaded || fontError;

  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync();
  }, [fontsReady]);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <AuthProvider>
            <OfflineSyncProvider>
              {/* Outside the navigator on purpose: the copy in flight has to
                  draw above both the screen it leaves and the one it joins. */}
              <SharedElementProvider>
                <AppRuntime />
              </SharedElementProvider>
            </OfflineSyncProvider>
          </AuthProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
