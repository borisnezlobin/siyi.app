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
import { colors } from "@/constants/theme";
import { AuthProvider } from "@/providers/auth-provider";
import { useAuth } from "@/providers/auth-provider";
import { OfflineSyncProvider } from "@/providers/offline-sync-provider";
import {
  appRouteFromNotificationUrl,
  configureNotificationPresentation,
  refreshExistingPushRegistration,
} from "@/lib/native-push";

void SplashScreen.preventAutoHideAsync();
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
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <AuthProvider>
            <OfflineSyncProvider>
              <AppRuntime />
            </OfflineSyncProvider>
          </AuthProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
