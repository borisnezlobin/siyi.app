import { Redirect } from "expo-router";
import { LoadingState } from "@/components/load-state";
import { useAuth } from "@/providers/auth-provider";

export default function IndexScreen() {
  const { session, profile, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (!session) return <Redirect href="/auth" />;
  if (!profile?.onboardingCompletedAt) {
    return <Redirect href="/onboarding" />;
  }
  return <Redirect href="/today" />;
}
