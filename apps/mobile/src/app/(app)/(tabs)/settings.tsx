import Constants from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import * as Localization from "expo-localization";
import {
  AddressBook,
  ArrowRight,
  BellRinging,
  DownloadSimple,
  FileCsv,
  FileText,
  Fingerprint,
  Key,
  Lock,
  SignOut,
  Trash,
  UploadSimple,
} from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import { ErrorState, LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { Card, PressableCard, SectionHeading } from "@/components/surface";
import { TimezonePicker } from "@/components/timezone-picker";
import { brand } from "@/config/brand";
import { colors, radii } from "@/constants/theme";
import {
  chooseImportFile,
  deleteAccount,
  getAccountSettings,
  importAccountData,
  saveAccountSettings,
  shareAccountExport,
  type ExportFormat,
} from "@/lib/data";
import {
  hasContactsPermission,
  isContactSyncEnabled,
  requestContactsPermission,
  setContactSyncEnabled,
} from "@/lib/device-contacts";
import { relationshipTierLabels } from "@/lib/relationship-labels";
import type { ReminderDefaults } from "@/lib/types";
import { useRefreshableData } from "@/hooks/use-refreshable-data";
import { useAuth } from "@/providers/auth-provider";

type PendingImport = Awaited<ReturnType<typeof chooseImportFile>>;

export default function SettingsScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [contactSyncEnabled, setContactSyncState] = useState(false);

  useEffect(() => {
    void isContactSyncEnabled().then(setContactSyncState);
  }, []);

  async function toggleContactSync(enabled: boolean) {
    if (!enabled) {
      await setContactSyncEnabled(false);
      setContactSyncState(false);
      return;
    }
    const granted =
      (await hasContactsPermission()) || (await requestContactsPermission());
    if (!granted) {
      Alert.alert(
        "Contacts access is off",
        "Turn on contacts access for Siyi in your device settings to use this.",
      );
      return;
    }
    await setContactSyncEnabled(true);
    setContactSyncState(true);
  }
  const accountData = useRefreshableData(() =>
    getAccountSettings(auth.session!.user.id),
  );
  const [timezoneDraft, setTimezoneDraft] = useState<string | null>(null);
  const [intervalDraft, setIntervalDraft] =
    useState<ReminderDefaults | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingImport, setPendingImport] = useState<PendingImport>(null);
  const detectedTimezone =
    Localization.getCalendars()[0]?.timeZone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    "UTC";

  if (accountData.loading && !accountData.data) {
    return <LoadingState label="Opening settings…" />;
  }
  if (accountData.error && !accountData.data) {
    return (
      <ErrorState
        message={accountData.error}
        onRetry={() => void accountData.reload()}
      />
    );
  }

  const settings = accountData.data!;
  const timezone = timezoneDraft ?? settings.timezone;
  const intervals = intervalDraft ?? settings.reminderDefaults;
  const providers = Array.from(
    new Set(
      (
        (auth.session?.user.app_metadata.providers as string[] | undefined) ||
        [auth.session?.user.app_metadata.provider as string]
      ).filter(Boolean),
    ),
  );

  async function savePreferences() {
    setBusyAction("save");
    setError(null);
    setMessage(null);
    try {
      await saveAccountSettings(
        auth.session!.user.id,
        timezone.trim(),
        intervals,
      );
      setTimezoneDraft(null);
      setIntervalDraft(null);
      await accountData.reload();
      setMessage("Your reminder defaults are saved.");
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Settings could not be saved.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function exportFormat(format: ExportFormat) {
    setBusyAction(`export-${format}`);
    setError(null);
    setMessage(null);
    try {
      await shareAccountExport(auth.session!, brand.webUrl, format);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Your export could not be created.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function chooseImport() {
    setBusyAction("choose-import");
    setError(null);
    setMessage(null);
    try {
      setPendingImport(await chooseImportFile());
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "That file could not be read.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function confirmImport() {
    if (!pendingImport) return;
    setBusyAction("import");
    setError(null);
    try {
      const result = await importAccountData(
        auth.session!,
        brand.webUrl,
        pendingImport.payload,
      );
      setPendingImport(null);
      setMessage(
        `Imported ${result.imported.people} people, ${result.imported.updates} updates, ${result.imported.interactions} legacy interactions, and ${result.imported.followUps} follow-ups.`,
      );
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      );
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "The import could not be completed.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  function requestAccountDeletion() {
    Alert.alert(
      "Delete your account?",
      "This permanently removes your account, people, updates, interactions, follow-ups, photos, and notification records. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => {
            setBusyAction("delete");
            setError(null);
            void (async () => {
              let appleAuthorizationCode: string | null = null;
              if (Platform.OS === "ios" && providers.includes("apple")) {
                const credential =
                  await AppleAuthentication.signInAsync();
                const appleIdentity = auth.session!.user.identities?.find(
                  ({ provider }) => provider === "apple",
                );
                const expectedAppleUser =
                  appleIdentity?.identity_data?.sub || appleIdentity?.id;
                if (
                  expectedAppleUser &&
                  credential.user !== expectedAppleUser
                ) {
                  throw new Error(
                    "Use the same Apple Account that is connected to this account.",
                  );
                }
                appleAuthorizationCode =
                  credential.authorizationCode || null;
              }

              const result = await deleteAccount(
                auth.session!,
                brand.webUrl,
                appleAuthorizationCode,
              );
              await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
              );
              if (!result.appleAuthorizationRevoked) {
                Alert.alert(
                  "Account deleted",
                  "Your data is gone. To finish disconnecting Apple, open iPhone Settings, tap your name, then Sign-In & Security and Sign in with Apple.",
                );
              }
            })()
              .catch((deleteError) => {
                setError(
                  deleteError instanceof Error
                    ? deleteError.message
                    : "Your account could not be deleted.",
                );
              })
              .finally(() => setBusyAction(null));
          },
        },
      ],
    );
  }

  return (
    <Screen
      eyebrow="Make it work your way"
      onRefresh={() => void accountData.refresh()}
      refreshing={accountData.refreshing}
      subtitle="Adjust timing, notifications, account access, and your data."
      title="Settings"
    >
      <Card style={styles.profileCard}>
        <View style={styles.profileMark}>
          <AppText style={styles.profileInitial} variant="title">
            {(auth.profile?.displayName || auth.profile?.email || "Y")
              .slice(0, 1)
              .toUpperCase()}
          </AppText>
        </View>
        <View style={styles.flex}>
          <AppText variant="heading">
            {auth.profile?.displayName || "Your account"}
          </AppText>
          <AppText variant="caption">{auth.profile?.email}</AppText>
        </View>
      </Card>

      <View style={styles.section}>
        <SectionHeading title="Notifications" />
        <PressableCard
          onPress={() => router.push("/notifications")}
          style={styles.navigationRow}
        >
          <View style={styles.rowIcon}>
            <BellRinging
              color={colors.coralStrong}
              size={23}
              weight="duotone"
            />
          </View>
          <View style={styles.flex}>
            <AppText variant="label">Push and reminder timing</AppText>
            <AppText variant="caption">
              Permission, categories, preferred hour, and a test
            </AppText>
          </View>
          <ArrowRight color={colors.inkMuted} size={19} />
        </PressableCard>
      </View>

      <View style={styles.section}>
        <SectionHeading
          detail="Only ever fills in blanks, never overwrites"
          title="Device contacts"
        />
        <Card style={styles.navigationRow}>
          <View style={styles.rowIcon}>
            <AddressBook color={colors.sageStrong} size={23} weight="duotone" />
          </View>
          <View style={styles.flex}>
            <AppText variant="label">Add saved people to contacts</AppText>
            <AppText variant="caption">
              {contactSyncEnabled
                ? "New and edited people are added to your phone"
                : "Off — nothing is written to your contacts"}
            </AppText>
          </View>
          <Switch
            onValueChange={(value) => void toggleContactSync(value)}
            trackColor={{ true: colors.sageStrong, false: colors.mist }}
            value={contactSyncEnabled}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeading
          detail="Used unless a person has their own interval"
          title="Check-in defaults"
        />
        <Card style={styles.settingsCard}>
          {([1, 2, 3, 4] as const).map((strength) => (
            <View key={strength} style={styles.intervalRow}>
              <View style={styles.strengthBadge}>
                <AppText style={styles.strengthText} variant="label">
                  {strength}
                </AppText>
              </View>
              <View style={styles.flex}>
                <AppText variant="label">
                  {relationshipTierLabels[strength]}
                </AppText>
                <AppText variant="caption">Remind after</AppText>
              </View>
              <View style={styles.daysField}>
                <FormField
                  keyboardType="number-pad"
                  label=""
                  maxLength={4}
                  onChangeText={(value) => {
                    const days = Number.parseInt(value, 10);
                    if (Number.isNaN(days)) return;
                    setIntervalDraft({
                      ...intervals,
                      [strength]: Math.min(3650, Math.max(1, days)),
                    });
                  }}
                  value={String(intervals[strength])}
                />
              </View>
              <AppText variant="caption">days</AppText>
            </View>
          ))}
          <View style={styles.timezoneCopy}>
            <AppText variant="label">Your local time</AppText>
            <AppText variant="caption">
              Used for reminders and upcoming dates.
            </AppText>
          </View>
          <TimezonePicker
            detectedTimezone={detectedTimezone}
            onChange={setTimezoneDraft}
            value={timezone}
          />
          <Button
            label="Save defaults"
            loading={busyAction === "save"}
            onPress={() => void savePreferences()}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeading
          detail="Portable formats you control"
          title="Your data"
        />
        <Card style={styles.settingsCard}>
          <Button
            icon={FileText}
            label="Export everything as JSON"
            loading={busyAction === "export-json"}
            onPress={() => void exportFormat("json")}
            variant="secondary"
          />
          <Button
            icon={FileCsv}
            label="Export contacts as CSV"
            loading={busyAction === "export-people-csv"}
            onPress={() => void exportFormat("people-csv")}
            variant="secondary"
          />
          <Button
            icon={DownloadSimple}
            label="Export updates as CSV"
            loading={busyAction === "export-updates-csv"}
            onPress={() => void exportFormat("updates-csv")}
            variant="secondary"
          />
          <Button
            icon={UploadSimple}
            label="Choose JSON to import"
            loading={busyAction === "choose-import"}
            onPress={() => void chooseImport()}
            variant="quiet"
          />
          {pendingImport ? (
            <View style={styles.importPreview}>
              <AppText variant="heading">Ready to preview</AppText>
              <AppText style={styles.muted}>
                {pendingImport.preview.people} people ·{" "}
                {pendingImport.preview.updates} updates ·{" "}
                {pendingImport.preview.interactions} legacy interactions ·{" "}
                {pendingImport.preview.followUps} follow-ups ·{" "}
                {pendingImport.preview.tags} tags
              </AppText>
              <AppText variant="caption">
                Import merges records by ID. It does not delete what is already
                here.
              </AppText>
              <View style={styles.previewActions}>
                <Button
                  compact
                  label="Cancel"
                  onPress={() => setPendingImport(null)}
                  variant="quiet"
                />
                <Button
                  compact
                  label="Import"
                  loading={busyAction === "import"}
                  onPress={() => void confirmImport()}
                />
              </View>
            </View>
          ) : null}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeading title="Account and access" />
        <Card style={styles.settingsCard}>
          <View style={styles.providerRow}>
            <Fingerprint color={colors.sageStrong} size={22} weight="duotone" />
            <View style={styles.flex}>
              <AppText variant="label">Sign-in methods</AppText>
              <AppText variant="caption">
                {providers.length > 0
                  ? providers
                      .map((provider) =>
                        provider === "email"
                          ? "Email"
                          : provider.charAt(0).toUpperCase() + provider.slice(1),
                      )
                      .join(", ")
                  : "Email"}
              </AppText>
            </View>
          </View>
          <Button
            icon={Key}
            label="Set or change password"
            onPress={() => router.push("/reset-password")}
            variant="secondary"
          />
          <Button
            icon={SignOut}
            label="Sign out"
            onPress={() => void auth.signOut()}
            variant="quiet"
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeading title="About" />
        <Card style={styles.linkCard}>
          <SettingsLink
            icon={Lock}
            label="Privacy Policy"
            onPress={() => router.push("/legal/privacy")}
          />
          <SettingsLink
            icon={FileText}
            label="Terms of Service"
            onPress={() => router.push("/legal/terms")}
          />
          <AppText style={styles.version} variant="caption">
            {brand.name} {Constants.expoConfig?.version || "1.0.0"} · build{" "}
            {Constants.expoConfig?.ios?.buildNumber ||
              Constants.expoConfig?.android?.versionCode ||
              "development"}
          </AppText>
        </Card>
      </View>

      {message ? (
        <View style={styles.message}>
          <AppText style={styles.messageText} variant="caption">
            {message}
          </AppText>
        </View>
      ) : null}
      {error ? (
        <View style={styles.error}>
          <AppText style={styles.errorText} variant="caption">
            {error}
          </AppText>
        </View>
      ) : null}

      <View style={styles.dangerSection}>
        <AppText style={styles.dangerHeading} variant="heading">
          Delete account
        </AppText>
        <AppText style={styles.muted}>
          Permanently removes every person, note, photo, update, interaction,
          follow-up, subscription, and your sign-in identity.
        </AppText>
        <Button
          icon={Trash}
          label="Delete account and data"
          loading={busyAction === "delete"}
          onPress={requestAccountDeletion}
          variant="danger"
        />
      </View>
    </Screen>
  );
}

function SettingsLink({
  icon: IconComponent,
  label,
  onPress,
}: {
  icon: typeof Lock;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.linkRow}
    >
      <IconComponent color={colors.inkMuted} size={20} weight="duotone" />
      <AppText style={styles.flex} variant="label">
        {label}
      </AppText>
      <ArrowRight color={colors.inkMuted} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
  },
  profileMark: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radii.round,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  profileInitial: {
    color: colors.paper,
    fontSize: 28,
    lineHeight: 31,
  },
  flex: {
    flex: 1,
  },
  section: {
    gap: 11,
  },
  navigationRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  rowIcon: {
    alignItems: "center",
    backgroundColor: colors.coralSoft,
    borderRadius: radii.medium,
    height: 46,
    justifyContent: "center",
    width: 46,
  },
  settingsCard: {
    gap: 13,
  },
  timezoneCopy: {
    gap: 3,
    marginTop: 4,
  },
  intervalRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 9,
  },
  strengthBadge: {
    alignItems: "center",
    backgroundColor: colors.sage,
    borderRadius: radii.round,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  strengthText: {
    color: colors.sageStrong,
  },
  daysField: {
    width: 72,
  },
  importPreview: {
    backgroundColor: colors.sage,
    borderRadius: radii.large,
    gap: 7,
    padding: 15,
  },
  muted: {
    color: colors.inkMuted,
  },
  previewActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 5,
  },
  providerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
  },
  linkCard: {
    paddingVertical: 6,
  },
  linkRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 11,
    minHeight: 50,
    paddingHorizontal: 8,
  },
  version: {
    color: colors.inkMuted,
    padding: 8,
  },
  message: {
    backgroundColor: colors.sage,
    borderRadius: radii.medium,
    padding: 13,
  },
  messageText: {
    color: colors.sageStrong,
  },
  error: {
    backgroundColor: colors.coralSoft,
    borderRadius: radii.medium,
    padding: 13,
  },
  errorText: {
    color: colors.coralStrong,
  },
  dangerSection: {
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    gap: 11,
    padding: 18,
  },
  dangerHeading: {
    color: colors.coralStrong,
  },
});
