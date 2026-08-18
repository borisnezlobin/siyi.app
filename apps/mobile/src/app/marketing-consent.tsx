import { Redirect } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { brand } from "@/config/brand";
import { colors } from "@/constants/theme";
import { saveMarketingOptIn } from "@/lib/data";
import { useAuth } from "@/providers/auth-provider";

/**
 * Signing in with Google or Apple never passes a signup form, so it never
 * passes the box that asks about email. The question gets its own screen
 * instead of an assumed answer, and both answers are recorded so it is asked
 * exactly once.
 */
export default function MarketingConsentScreen() {
  const auth = useAuth();
  const [saving, setSaving] = useState<"yes" | "no" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (auth.loading) return <LoadingState />;
  if (!auth.session) return <Redirect href="/auth" />;
  if (auth.profile?.marketingPromptedAt) return <Redirect href="/today" />;

  async function answer(optIn: boolean) {
    if (!auth.session) return;
    setSaving(optIn ? "yes" : "no");
    setError(null);
    try {
      await saveMarketingOptIn(auth.session.user.id, optIn);
      await auth.refreshProfile();
    } catch {
      setError("That could not be saved. Try again in a moment.");
      setSaving(null);
    }
  }

  return (
    <Screen contentContainerStyle={styles.stack}>
      <AppText variant="display">Want to hear from us?</AppText>
      <AppText style={styles.muted}>
        Every so often we send a short note about what&apos;s new in{" "}
        {brand.shortName}. Only things worth reading, and never often. You can
        change your mind any time in settings.
      </AppText>

      {error ? (
        <AppText style={styles.error} variant="caption">
          {error}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Yes, keep me posted"
          loading={saving === "yes"}
          onPress={() => void answer(true)}
        />
        <Button
          label="No thanks"
          loading={saving === "no"}
          onPress={() => void answer(false)}
          variant="quiet"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
    justifyContent: "center",
  },
  muted: {
    color: colors.inkMuted,
  },
  error: {
    color: colors.coralStrong,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
});
