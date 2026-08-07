import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  BellRinging,
  Gear,
  PaperPlaneTilt,
} from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { ErrorState, LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { brand } from "@/config/brand";
import { colors, radii } from "@/constants/theme";
import {
  getAccountSettings,
  saveNotificationPreferences,
} from "@/lib/data";
import { formatReminderHour, reminderHourOptions } from "@/lib/reminder-hours";
import {
  disableNativePush,
  enableNativePush,
  getPushPermissionState,
  sendNativeTestNotification,
  type PushPermissionState,
} from "@/lib/native-push";
import type { NotificationPreference } from "@/lib/types";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useAuth } from "@/providers/auth-provider";

/** Monday first: the week people plan around, not the week the calendar prints. */
const weekdayLabels = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

type PreferenceDraft = Omit<
  NotificationPreference,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

export default function NotificationsScreen() {
  const router = useRouter();
  const auth = useAuth();
  const accountData = useRefreshableData(() =>
    getAccountSettings(auth.session!.user.id),
  );
  const [permission, setPermission] =
    useState<PushPermissionState>("undetermined");
  const [draft, setDraft] = useState<PreferenceDraft | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void getPushPermissionState().then(setPermission);
  }, []);

  useEffect(() => {
    if (!draft && accountData.data) {
      const preference = accountData.data.notificationPreference;
      setDraft({
        pushEnabled: preference.pushEnabled,
        overdueContactEnabled: preference.overdueContactEnabled,
        birthdayEnabled: preference.birthdayEnabled,
        reminderEnabled: preference.reminderEnabled,
        reminderHourLocal: preference.reminderHourLocal,
        reminderDaysOfWeek: preference.reminderDaysOfWeek,
      });
    }
  }, [accountData.data, draft]);

  if (accountData.loading && !accountData.data) {
    return <LoadingState label="Checking notification settings…" />;
  }
  if (accountData.error && !accountData.data) {
    return (
      <ErrorState
        message={accountData.error}
        onRetry={() => void accountData.reload()}
      />
    );
  }

  const preferences = draft!;
  const permissionCopy: Record<
    PushPermissionState,
    { title: string; body: string }
  > = {
    granted: {
      title: "Allowed on this device",
      body: "This device can receive the categories you enable below.",
    },
    denied: {
      title: "Blocked in device settings",
      body: "Open device settings if you would like to allow notifications.",
    },
    undetermined: {
      title: "Not requested yet",
      body: "We will show the system prompt only after you choose Enable push.",
    },
    unavailable: {
      title: "Unavailable here",
      body: "Remote push needs a physical iPhone or Android device and a release or development build.",
    },
  };

  async function enable() {
    setBusyAction("enable");
    setError(null);
    setMessage(null);
    try {
      await enableNativePush(auth.session!);
      setPermission(await getPushPermissionState());
      setDraft({ ...preferences, pushEnabled: true });
      setMessage("Push notifications are enabled on this device.");
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
    } catch (enableError) {
      setPermission(await getPushPermissionState());
      setError(
        enableError instanceof Error
          ? enableError.message
          : "Push notifications could not be enabled.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function disable() {
    setBusyAction("disable");
    setError(null);
    setMessage(null);
    try {
      await disableNativePush(auth.session!);
      setDraft({ ...preferences, pushEnabled: false });
      setMessage("Push notifications are off.");
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
    } catch (disableError) {
      setError(
        disableError instanceof Error
          ? disableError.message
          : "Push notifications could not be disabled.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function save() {
    setBusyAction("save");
    setError(null);
    setMessage(null);
    try {
      await saveNotificationPreferences(
        auth.session!.user.id,
        preferences,
      );
      setMessage("Your notification preferences are saved.");
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Preferences could not be saved.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function testNotification() {
    setBusyAction("test");
    setError(null);
    setMessage(null);
    try {
      await sendNativeTestNotification(auth.session!, brand.webUrl);
      setMessage("Test sent. It may take a few seconds to arrive.");
    } catch (testError) {
      setError(
        testError instanceof Error
          ? testError.message
          : "The test could not be sent.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Screen bottomInset={56}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.back}
        >
          <ArrowLeft color={colors.ink} size={21} />
        </Pressable>
      </View>
      <View style={styles.header}>
        <AppText variant="display">Notifications</AppText>
        <AppText style={styles.muted}>
          Useful timing, clear controls, and no attention tricks.
        </AppText>
      </View>

      <View style={styles.section}>
        <AppText variant="heading">{permissionCopy[permission].title}</AppText>
        <AppText style={styles.muted}>
          {permissionCopy[permission].body}
        </AppText>
        <View style={styles.actions}>
          {preferences.pushEnabled ? (
            <Button
              icon={BellRinging}
              label="Turn off push"
              loading={busyAction === "disable"}
              onPress={() => void disable()}
            />
          ) : (
            <Button
              icon={BellRinging}
              label="Enable push"
              loading={busyAction === "enable"}
              onPress={() => void enable()}
            />
          )}
          {permission === "denied" ? (
            <Button
              icon={Gear}
              label="Open device settings"
              onPress={() => void Linking.openSettings()}
              variant="quiet"
            />
          ) : null}
          <Button
            disabled={!preferences.pushEnabled || permission !== "granted"}
            icon={PaperPlaneTilt}
            label="Send a test"
            loading={busyAction === "test"}
            onPress={() => void testNotification()}
            variant="quiet"
          />
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="heading">What should arrive?</AppText>
        <PreferenceSwitch
          body="A person is past the reminder interval you chose."
          label="People to check in with"
          onChange={(enabled) =>
            setDraft({ ...preferences, overdueContactEnabled: enabled })
          }
          value={preferences.overdueContactEnabled}
        />
        <PreferenceSwitch
          body="A birthday is approaching."
          label="Upcoming birthdays"
          onChange={(enabled) =>
            setDraft({ ...preferences, birthdayEnabled: enabled })
          }
          value={preferences.birthdayEnabled}
        />
        <PreferenceSwitch
          body="A reminder is due or overdue."
          label="Reminders"
          onChange={(enabled) =>
            setDraft({ ...preferences, reminderEnabled: enabled })
          }
          value={preferences.reminderEnabled}
        />
      </View>

      <View style={styles.section}>
        <AppText variant="heading">Preferred local time</AppText>
        <AppText style={styles.muted}>
          The scheduler evaluates this in your saved timezone. Actual delivery
          can vary slightly by provider and device state.
        </AppText>
        <View style={styles.hourGrid}>
          {reminderHourOptions(preferences.reminderHourLocal).map((hour) => {
            const selected = preferences.reminderHourLocal === hour;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={hour}
                onPress={() => {
                  setDraft({ ...preferences, reminderHourLocal: hour });
                  void Haptics.selectionAsync();
                }}
                style={[styles.hour, selected && styles.hourSelected]}
              >
                <AppText
                  style={selected ? styles.lightText : undefined}
                  variant="label"
                >
                  {formatReminderHour(hour)}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <AppText variant="label">Reminder days</AppText>
        <View style={styles.dayRow}>
          {weekdayLabels.map((day) => {
            const selected = preferences.reminderDaysOfWeek.includes(day.value);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={day.value}
                onPress={() => {
                  setDraft({
                    ...preferences,
                    reminderDaysOfWeek: selected
                      ? preferences.reminderDaysOfWeek.filter(
                          (value) => value !== day.value,
                        )
                      : [...preferences.reminderDaysOfWeek, day.value].sort(),
                  });
                  void Haptics.selectionAsync();
                }}
                style={[styles.day, selected && styles.daySelected]}
              >
                <AppText
                  style={selected ? styles.lightText : undefined}
                  variant="caption"
                >
                  {day.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        {preferences.reminderDaysOfWeek.length === 0 ? (
          <AppText style={styles.errorText} variant="caption">
            Choose at least one day.
          </AppText>
        ) : null}

        <Button
          disabled={preferences.reminderDaysOfWeek.length === 0}
          label="Save preferences"
          loading={busyAction === "save"}
          onPress={() => void save()}
        />
      </View>

      <View style={styles.section}>
        <AppText variant="heading">What to expect</AppText>
        <AppText style={styles.muted}>
          Focus modes and battery saving can delay or hide alerts. Push needs a
          network connection.
        </AppText>
        <AppText style={styles.muted}>
          Remote push is not testable inside Expo Go on Android; use a
          development or release build on a physical device.
        </AppText>
      </View>

      {message ? (
        <View style={styles.message}>
          <AppText style={styles.messageText}>{message}</AppText>
        </View>
      ) : null}
      {error ? (
        <View style={styles.error}>
          <AppText style={styles.errorText}>{error}</AppText>
        </View>
      ) : null}
    </Screen>
  );
}

function PreferenceSwitch({
  label,
  body,
  value,
  onChange,
}: {
  label: string;
  body: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.flex}>
        <AppText variant="label">{label}</AppText>
        <AppText variant="caption">{body}</AppText>
      </View>
      <Switch
        accessibilityLabel={label}
        ios_backgroundColor={colors.mist}
        onValueChange={onChange}
        thumbColor={colors.paper}
        trackColor={{ false: colors.mist, true: colors.sageStrong }}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: "flex-start",
  },
  back: {
    alignItems: "center",
    backgroundColor: colors.paper,
    borderRadius: radii.small,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  header: {
    gap: 6,
  },
  muted: {
    color: colors.inkMuted,
  },
  flex: {
    flex: 1,
  },
  actions: {
    gap: 7,
    paddingTop: 4,
  },
  section: {
    gap: 11,
  },
  switchRow: {
    alignItems: "center",
    borderBottomColor: colors.mist,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 11,
    paddingBottom: 11,
  },
  hourGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  hour: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.medium,
    minHeight: 44,
    minWidth: 62,
    paddingHorizontal: 13,
    justifyContent: "center",
  },
  hourSelected: {
    backgroundColor: colors.ink,
  },
  lightText: {
    color: colors.paper,
  },
  dayRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  day: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.small,
    minWidth: 42,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  daySelected: {
    backgroundColor: colors.sageStrong,
  },
  message: {
    backgroundColor: colors.sage,
    borderRadius: radii.medium,
    padding: 13,
  },
  messageText: {
    color: colors.sageStrong,
    flex: 1,
  },
  error: {
    backgroundColor: colors.coralSoft,
    borderRadius: radii.medium,
    padding: 13,
  },
  errorText: {
    color: colors.coralStrong,
  },
});
