import * as Localization from "expo-localization";
import * as Haptics from "expo-haptics";
import { BellRinging, ShieldCheck } from "phosphor-react-native";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import { LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { Card } from "@/components/surface";
import { TimezonePicker } from "@/components/timezone-picker";
import { brand } from "@/config/brand";
import { colors, radii } from "@/constants/theme";
import { completeOnboarding } from "@/lib/data";
import { useAuth } from "@/providers/auth-provider";

export default function OnboardingScreen() {
  const router = useRouter();
  const auth = useAuth();
  const detectedTimezone =
    Localization.getCalendars()[0]?.timeZone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";
  const locale = Localization.getLocales()[0]?.languageTag || "en-US";
  const [displayName, setDisplayName] = useState(
    auth.profile?.displayName || "",
  );
  const [timezone, setTimezone] = useState(detectedTimezone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (auth.loading) return <LoadingState />;
  if (!auth.session) return <Redirect href="/auth" />;
  if (auth.profile?.onboardingCompletedAt) {
    return <Redirect href="/today" />;
  }

  async function finish(setUpNotifications: boolean) {
    if (!displayName.trim()) {
      setError("Add the name you would like us to use.");
      return;
    }
    if (!timezone.trim()) {
      setError("Choose the city or timezone closest to you.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await completeOnboarding({
        userId: auth.session!.user.id,
        displayName,
        timezone,
        locale,
      });
      await auth.refreshProfile();
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
      router.replace(setUpNotifications ? "/notifications" : "/today");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Your setup could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen
      bottomInset={40}
      eyebrow="A minute now saves awkward moments later"
      maxContentWidth={720}
      subtitle="You can change all of this from Settings."
      title="Make it yours"
    >
      <Card style={styles.formCard}>
        <FormField
          autoCapitalize="words"
          autoComplete="name"
          label="Your name"
          onChangeText={setDisplayName}
          placeholder="What should we call you?"
          value={displayName}
        />
        <View style={styles.timezoneCopy}>
          <AppText variant="label">Your local time</AppText>
          <AppText variant="caption">
            Used for birthdays, follow-ups, and reminder timing.
          </AppText>
        </View>
        <TimezonePicker
          detectedTimezone={detectedTimezone}
          onChange={setTimezone}
          value={timezone}
        />
      </Card>

      <Card style={styles.notificationCard}>
        <View style={styles.notificationIcon}>
          <BellRinging color={colors.coralStrong} size={28} weight="duotone" />
        </View>
        <View style={styles.notificationCopy}>
          <AppText variant="heading">Gentle reminders, on your terms</AppText>
          <AppText style={styles.muted}>
            {`${brand.name} can surface due follow-ups, birthdays, and people you meant to check in with. We will only ask your device for permission after you tap “Set up notifications.”`}
          </AppText>
          <View style={styles.privacyLine}>
            <ShieldCheck color={colors.sageStrong} size={18} weight="duotone" />
            <AppText style={styles.privacyCopy} variant="caption">
              Notification categories and quiet timing stay under your control.
            </AppText>
          </View>
        </View>
      </Card>

      {error ? (
        <View style={styles.error}>
          <AppText style={styles.errorText} variant="caption">
            {error}
          </AppText>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Set up notifications"
          loading={saving}
          onPress={() => void finish(true)}
        />
        <Button
          disabled={saving}
          label="Maybe later"
          onPress={() => void finish(false)}
          variant="quiet"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  formCard: {
    gap: 18,
  },
  flex: {
    flex: 1,
  },
  timezoneCopy: {
    gap: 3,
  },
  notificationCard: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 14,
  },
  notificationIcon: {
    alignItems: "center",
    backgroundColor: colors.coralSoft,
    borderRadius: radii.medium,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  notificationCopy: {
    flex: 1,
    gap: 7,
  },
  muted: {
    color: colors.inkMuted,
  },
  privacyLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    marginTop: 4,
  },
  privacyCopy: {
    color: colors.sageStrong,
    flex: 1,
  },
  error: {
    backgroundColor: colors.coralSoft,
    borderRadius: radii.medium,
    padding: 12,
  },
  errorText: {
    color: colors.coralStrong,
  },
  actions: {
    gap: 6,
  },
});
