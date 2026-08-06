import * as Haptics from "expo-haptics";
import {
  ArrowLeft,
  BellRinging,
  Cake,
  ChatCircleDots,
  CheckCircle,
  ClockCountdown,
  DeviceMobile,
  Gear,
  PaperPlaneTilt,
  ShieldCheck,
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
import { Card, SectionHeading } from "@/components/surface";
import { brand } from "@/config/brand";
import { colors, radii } from "@/constants/theme";
import {
  getAccountSettings,
  saveNotificationPreferences,
} from "@/lib/data";
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
        followUpEnabled: preference.followUpEnabled,
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
    { title: string; body: string; color: string }
  > = {
    granted: {
      title: "Allowed on this device",
      body: "This device can receive the categories you enable below.",
      color: colors.sageStrong,
    },
    denied: {
      title: "Blocked in device settings",
      body: "Open Settings if you would like to allow notifications.",
      color: colors.coralStrong,
    },
    undetermined: {
      title: "Not requested yet",
      body: "We will show the system prompt only after you tap Enable.",
      color: colors.ink,
    },
    unavailable: {
      title: "Unavailable here",
      body: "Remote push needs a physical iPhone or Android device and a release or development build.",
      color: colors.inkMuted,
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

      <Card style={styles.permissionCard}>
        <View style={styles.permissionIcon}>
          <DeviceMobile
            color={permissionCopy[permission].color}
            size={28}
            weight="duotone"
          />
        </View>
        <View style={styles.flex}>
          <AppText variant="heading">
            {permissionCopy[permission].title}
          </AppText>
          <AppText style={styles.muted}>
            {permissionCopy[permission].body}
          </AppText>
        </View>
      </Card>

      <View style={styles.actions}>
        {preferences.pushEnabled ? (
          <Button
            label="Disable push"
            loading={busyAction === "disable"}
            onPress={() => void disable()}
            variant="secondary"
          />
        ) : (
          <Button
            icon={BellRinging}
            label="Enable push notifications"
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
          disabled={
            !preferences.pushEnabled || permission !== "granted"
          }
          icon={PaperPlaneTilt}
          label="Send a test notification"
          loading={busyAction === "test"}
          onPress={() => void testNotification()}
          variant="quiet"
        />
      </View>

      <View style={styles.section}>
        <SectionHeading title="Categories" />
        <Card style={styles.settingsCard}>
          <PreferenceSwitch
            body="A person is past the reminder interval you chose."
            icon={ChatCircleDots}
            label="People to check in with"
            onChange={(enabled) =>
              setDraft({ ...preferences, overdueContactEnabled: enabled })
            }
            value={preferences.overdueContactEnabled}
          />
          <PreferenceSwitch
            body="A birthday is approaching."
            icon={Cake}
            label="Upcoming birthdays"
            onChange={(enabled) =>
              setDraft({ ...preferences, birthdayEnabled: enabled })
            }
            value={preferences.birthdayEnabled}
          />
          <PreferenceSwitch
            body="A reminder is due or overdue."
            icon={ClockCountdown}
            label="Reminders"
            onChange={(enabled) =>
              setDraft({ ...preferences, followUpEnabled: enabled })
            }
            value={preferences.followUpEnabled}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeading title="Preferred local time" />
        <Card style={styles.settingsCard}>
          <AppText style={styles.muted}>
            The scheduler evaluates this in your saved timezone. Actual delivery
            can vary slightly by provider and device state.
          </AppText>
          <View style={styles.hourGrid}>
            {[8, 10, 12, 18, 20].map((hour) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{
                  checked: preferences.reminderHourLocal === hour,
                }}
                key={hour}
                onPress={() => {
                  setDraft({ ...preferences, reminderHourLocal: hour });
                  void Haptics.selectionAsync();
                }}
                style={[
                  styles.hour,
                  preferences.reminderHourLocal === hour &&
                    styles.hourSelected,
                ]}
              >
                <AppText
                  style={
                    preferences.reminderHourLocal === hour
                      ? styles.lightText
                      : undefined
                  }
                  variant="label"
                >
                  {new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, {
                    hour: "numeric",
                  })}
                </AppText>
              </Pressable>
            ))}
          </View>
          <AppText variant="label">Reminder days</AppText>
          <View style={styles.dayRow}>
            {weekdayLabels.map((day) => {
              const selected =
                preferences.reminderDaysOfWeek.includes(day.value);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  key={day.value}
                  onPress={() => {
                    const days = selected
                      ? preferences.reminderDaysOfWeek.filter(
                          (value) => value !== day.value,
                        )
                      : [...preferences.reminderDaysOfWeek, day.value];
                    if (days.length === 0) return;
                    setDraft({
                      ...preferences,
                      reminderDaysOfWeek: days,
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
          <Button
            label="Save notification preferences"
            loading={busyAction === "save"}
            onPress={() => void save()}
          />
        </Card>
      </View>

      <Card style={styles.explanation}>
        <ShieldCheck color={colors.sageStrong} size={25} weight="duotone" />
        <View style={styles.flex}>
          <AppText variant="heading">What to expect</AppText>
          <AppText style={styles.muted}>
            iPhone Focus modes and Android battery settings can delay or hide
            alerts. Push requires a network connection. On iOS, reinstalling or
            restoring the app may refresh the device token automatically.
          </AppText>
          <AppText style={styles.muted}>
            Remote push is not testable inside Expo Go on Android; use a
            development or release build on a physical device.
          </AppText>
        </View>
      </Card>

      {message ? (
        <View style={styles.message}>
          <CheckCircle color={colors.sageStrong} size={20} weight="duotone" />
          <AppText style={styles.messageText}>{message}</AppText>
        </View>
      ) : null}
      {error ? (
        <View style={styles.error}>
          <AppText style={styles.errorText} variant="caption">
            {error}
          </AppText>
        </View>
      ) : null}
    </Screen>
  );
}

function PreferenceSwitch({
  icon: IconComponent,
  label,
  body,
  value,
  onChange,
}: {
  icon: typeof BellRinging;
  label: string;
  body: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchIcon}>
        <IconComponent color={colors.sageStrong} size={21} weight="duotone" />
      </View>
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
  permissionCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
  },
  permissionIcon: {
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: radii.medium,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  flex: {
    flex: 1,
  },
  actions: {
    gap: 7,
  },
  section: {
    gap: 11,
  },
  settingsCard: {
    gap: 17,
  },
  switchRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
  },
  switchIcon: {
    alignItems: "center",
    backgroundColor: colors.sage,
    borderRadius: radii.medium,
    height: 42,
    justifyContent: "center",
    width: 42,
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
  explanation: {
    alignItems: "flex-start",
    backgroundColor: colors.sage,
    flexDirection: "row",
    gap: 12,
  },
  message: {
    alignItems: "center",
    backgroundColor: colors.sage,
    borderRadius: radii.medium,
    flexDirection: "row",
    gap: 9,
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
