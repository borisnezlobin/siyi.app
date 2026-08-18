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
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { ContactSyncOverlay } from "@/components/contact-sync-overlay";
import { FoundPhotoOverlay } from "@/components/found-photo-overlay";
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
      <FoundPhotoOverlay />
    </>
  );
}

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
      {/* Outside every provider, because a throw inside one of them is exactly
          the case that used to leave a white screen with nothing to press. */}
      <AppErrorBoundary>
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
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}
