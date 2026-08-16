import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import { LoadingState } from "@/components/load-state";
import { colors } from "@/constants/theme";
import { prefetchScreenData } from "@/lib/screen-queries";
import { useAuth } from "@/providers/auth-provider";
import { QuickCaptureProvider } from "@/providers/quick-capture-provider";

export default function AuthenticatedLayout() {
  const { session, profile, loading } = useAuth();
  const userId = session?.user.id;

  // Above the redirects on purpose: hooks cannot sit behind an early return,
  // and this is the earliest moment the app knows whose data to ask for.
  useEffect(() => {
    if (!userId) return;
    prefetchScreenData(userId);
  }, [userId]);

  if (loading) return <LoadingState />;
  if (!session) return <Redirect href="/auth" />;
  if (!profile?.onboardingCompletedAt) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <QuickCaptureProvider>
      <Stack
        screenOptions={{
          animation: "slide_from_right",
          // Back from anywhere, by dragging from anywhere — not only from the
          // few pixels at the very edge of the screen.
          fullScreenGestureEnabled: true,
          gestureEnabled: true,
          contentStyle: { backgroundColor: colors.porcelain },
          headerShown: false,
        }}
      />
    </QuickCaptureProvider>
  );
}
