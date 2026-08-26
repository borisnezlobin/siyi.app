import * as Localization from "expo-localization";
import * as Haptics from "expo-haptics";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import { KeyboardAwareForm } from "@/components/keyboard-aware-form";
import { LoadingState } from "@/components/load-state";
import { TimezonePicker } from "@/components/timezone-picker";
import { brand } from "@/config/brand";
import { colors } from "@/constants/theme";
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
  // Signup already asked for a name, so the field only appears for the accounts
  // that arrived without one — a provider sign-in that handed over no profile.
  const knownName = (auth.profile?.displayName || "").trim();
  // Seeding state from knownName captured an empty string: the profile is
  // still null on the first render, and the `auth.loading` return below does
  // not stop this hook from initialising. Once the profile arrived the field
  // was hidden, so nothing could ever fill that empty value, and both footer
  // buttons failed a name check whose error had nowhere to appear. Deriving it
  // instead means a late profile is picked up without the state going stale.
  const [typedName, setTypedName] = useState("");
  const displayName = typedName || knownName;
  const [timezone, setTimezone] = useState(detectedTimezone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  if (auth.loading) return <LoadingState />;
  if (!auth.session) return <Redirect href="/auth" />;
  if (auth.profile?.onboardingCompletedAt) {
    return <Redirect href="/today" />;
  }

  async function finish(setUpNotifications: boolean) {
    if (!displayName.trim()) {
      setNameError("Add the name we should call you.");
      return;
    }
    if (!timezone.trim()) {
      setError("Choose the city or timezone closest to you.");
      return;
    }

    setSaving(true);
    setError(null);
    setNameError(null);
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
    <KeyboardAwareForm
      footer={
        <>
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
        </>
      }
      maxContentWidth={720}
    >
      <View style={styles.intro}>
        <AppText variant="display">
          {knownName ? `Make it yours, ${knownName}` : "Make it yours"}
        </AppText>
        <AppText style={styles.muted}>
          You can change all of this from Settings.
        </AppText>
      </View>

      {knownName ? null : (
        <FormField
          autoCapitalize="words"
          autoComplete="name"
          error={nameError ?? undefined}
          label="Your name"
          onChangeText={(value) => {
            setTypedName(value);
            if (nameError) setNameError(null);
          }}
          placeholder="What should we call you?"
          returnKeyType="done"
          value={displayName}
        />
      )}

      <View style={styles.timezoneGroup}>
        <View style={styles.timezoneCopy}>
          <AppText variant="label">Your local time</AppText>
          <AppText variant="caption">
            Used for birthdays and reminder timing.
          </AppText>
        </View>
        <TimezonePicker
          detectedTimezone={detectedTimezone}
          onChange={setTimezone}
          value={timezone}
        />
      </View>

      <View style={styles.notificationCopy}>
        <AppText variant="heading">Gentle reminders, on your terms</AppText>
        <AppText style={styles.muted}>
          {`${brand.name} can surface due reminders, birthdays, and people you meant to check in with. We will only ask for permission after you choose “Set up notifications”.`}
        </AppText>
        <AppText style={styles.muted} variant="caption">
          Notification categories and quiet timing stay under your control.
        </AppText>
      </View>

      {error ? (
        <AppText
          accessibilityLiveRegion="polite"
          style={styles.errorText}
          variant="caption"
        >
          {error}
        </AppText>
      ) : null}
    </KeyboardAwareForm>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: 8,
  },
  timezoneGroup: {
    gap: 10,
  },
  timezoneCopy: {
    gap: 3,
  },
  notificationCopy: {
    gap: 7,
  },
  muted: {
    color: colors.inkMuted,
  },
  errorText: {
    color: colors.coralStrong,
  },
});
