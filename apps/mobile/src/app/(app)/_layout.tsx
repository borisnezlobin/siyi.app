import { Redirect, Stack } from "expo-router";
import { LoadingState } from "@/components/load-state";
import { colors } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";
import { QuickCaptureProvider } from "@/providers/quick-capture-provider";

export default function AuthenticatedLayout() {
  const { session, profile, loading } = useAuth();

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
          contentStyle: { backgroundColor: colors.porcelain },
          headerShown: false,
        }}
      />
    </QuickCaptureProvider>
  );
}
