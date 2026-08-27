import Constants from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Haptics from "expo-haptics";
import * as Localization from "expo-localization";
import { CaretRight } from "phosphor-react-native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  View,
  type ViewStyle,
} from "react-native";
import { OwnCardSection } from "@/components/own-card-section";
import { AppText } from "@/components/app-text";
import { CalendarFeedSection } from "@/components/calendar-feed-section";
import { Button } from "@/components/button";
import { CollegeField } from "@/components/college-field";
import { FormField } from "@/components/form-field";
import { ErrorState, LoadingState } from "@/components/load-state";
import { Screen } from "@/components/screen";
import { SectionHeading } from "@/components/surface";
import { TimezonePicker } from "@/components/timezone-picker";
import {
  suggestUniversityFromEmail,
  universitySuggestionNote,
} from "@/lib/university-suggestion";
import { brand } from "@/config/brand";
import { colors, radii } from "@/constants/theme";
import {
  chooseImportFile,
  deleteAccount,
  getAccountSettings,
  importAccountData,
  saveAccountSettings,
  saveMarketingOptIn,
  saveOwnCard,
  shareAccountExport,
  type ExportFormat,
} from "@/lib/data";
import {
  enableContactSyncWithExplainer,
  runFullContactSync,
} from "@/lib/contact-sync-flow";
import {
  getContactsPermissionState,
  interruptedContactSyncCount,
  isContactSyncEnabled,
  openDeviceSettings,
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
  const accountData = useRefreshableData(() =>
    getAccountSettings(auth.session!.user.id),
  );
  const [timezoneDraft, setTimezoneDraft] = useState<string | null>(null);
  const [intervalDraft, setIntervalDraft] = useState<ReminderDefaults | null>(
    null,
  );
  const [marketingDraft, setMarketingDraft] = useState<boolean | null>(null);
  const [universityDraft, setUniversityDraft] = useState<string | null>(null);
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
  const marketingOptIn = marketingDraft ?? settings.marketingOptIn;
  const defaultUniversity = universityDraft ?? settings.defaultUniversity;
  // Offered while the field is blank, and gone the moment it is not.
  const universitySuggestion = suggestUniversityFromEmail(
    auth.profile?.email,
    defaultUniversity,
  );
  const providers = Array.from(
    new Set(
      (
        (auth.session?.user.app_metadata.providers as string[] | undefined) ||
        [auth.session?.user.app_metadata.provider as string]
      ).filter(Boolean),
    ),
  );

  async function saveMarketing(optIn: boolean) {
    setBusyAction("marketing");
    setError(null);
    setMessage(null);
    const previous = marketingOptIn;
    setMarketingDraft(optIn);
    try {
      await saveMarketingOptIn(auth.session!.user.id, optIn);
      setMessage(optIn ? "You are on the list." : "You are off the list.");
    } catch (caught) {
      setMarketingDraft(previous);
      setError(
        caught instanceof Error ? caught.message : "That could not be saved.",
      );
    }
    setBusyAction(null);
  }

  async function saveDefaultUniversity() {
    setBusyAction("university");
    setError(null);
    setMessage(null);
    try {
      await saveOwnCard(auth.session!.user.id, {
        card: settings.ownCard,
        enabled: settings.ownCardEnabled,
        defaultUniversity,
      });
      setUniversityDraft(null);
      await accountData.reload();
      setMessage("Saved. New people start with that university.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "That could not be saved.",
      );
    } finally {
      setBusyAction(null);
    }
  }

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
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
        `Imported ${result.imported.people} people, ${result.imported.updates} updates, ${result.imported.interactions} legacy interactions, and ${result.imported.reminders} reminders.`,
      );
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      "This permanently removes your account, people, updates, interactions, reminders, photos, and notification records. This cannot be undone.",
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
                const credential = await AppleAuthentication.signInAsync();
                const appleIdentity = auth.session!.user.identities?.find(
                  ({ provider }) => provider === "apple",
                );
                const expectedAppleUser =
                  appleIdentity?.identity_data?.sub || appleIdentity?.id;
                if (expectedAppleUser && credential.user !== expectedAppleUser) {
                  throw new Error(
                    "Use the same Apple Account that is connected to this account.",
                  );
                }
                appleAuthorizationCode = credential.authorizationCode || null;
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
      onRefresh={() => void accountData.refresh()}
      refreshing={accountData.refreshing}
      subtitle="Adjust timing, notifications, account access, and your data."
      title="Settings"
    >
      <View style={styles.identity}>
        <View style={styles.identityMark}>
          <AppText style={styles.identityInitial} variant="title">
            {(auth.profile?.displayName || auth.profile?.email || "Y")
              .slice(0, 1)
              .toUpperCase()}
          </AppText>
        </View>
        <View style={styles.grow}>
          <AppText variant="heading">
            {auth.profile?.displayName || "Your account"}
          </AppText>
          <AppText variant="caption">{auth.profile?.email}</AppText>
        </View>
      </View>

      {/* Inline, not behind a link: the code is the thing people came for, and
          the web puts it on this page too. */}
      <Section title="Your card">
        <OwnCardSection />
      </Section>

      <Section title="Notifications">
        <NavigationRow
          detail="Permission, categories, preferred hour, and a test"
          label="Push and reminder timing"
          onPress={() => router.push("/notifications")}
        />
      </Section>

      {/* Same place as the web settings page: right after notifications. */}
      <Section title="Calendar">
        <CalendarFeedSection />
      </Section>

      <DeviceContactsSection />

      {/* A default for the people you add, not a detail about you — the same
          section, in the same place, as the web settings page. */}
      <Section title="New person defaults">
        <AppText style={styles.sectionNote} variant="caption">
          Filled in for you when you add someone new. Leave blank for none.
        </AppText>
        <CollegeField
          onChangeText={setUniversityDraft}
          value={defaultUniversity}
        />
        {universitySuggestion ? (
          <View style={styles.suggestion}>
            <AppText style={styles.sectionNote} variant="caption">
              {universitySuggestionNote(universitySuggestion.domain)}:{" "}
              {universitySuggestion.name}
            </AppText>
            <Button
              compact
              label="Use it"
              onPress={() => setUniversityDraft(universitySuggestion.name)}
              variant="secondary"
            />
          </View>
        ) : null}
        <View style={styles.sectionAction}>
          <Button
            label="Save default"
            loading={busyAction === "university"}
            onPress={() => void saveDefaultUniversity()}
          />
        </View>
      </Section>

      <Section title="Check-in defaults">
        <AppText style={styles.sectionNote} variant="caption">
          Used unless a person has their own interval.
        </AppText>
        {([1, 2, 3, 4] as const).map((strength) => (
          <Row key={strength}>
            <AppText style={styles.grow} variant="label">
              {relationshipTierLabels[strength]}
            </AppText>
            <View style={styles.daysField}>
              <FormField
                accessibilityLabel={`${relationshipTierLabels[strength]} interval in days`}
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
          </Row>
        ))}
        <Row style={styles.columnRow}>
          <View>
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
        </Row>
        <View style={styles.sectionAction}>
          <Button
            label="Save defaults"
            loading={busyAction === "save"}
            onPress={() => void savePreferences()}
          />
        </View>
      </Section>

      <Section title="Emails from us">
        <AppText style={styles.sectionNote} variant="caption">
          Occasional notes about what is new. Nothing else.
        </AppText>
        {/* Beside its text, like every other switch in Settings, rather than
            stacked under a paragraph where it reads as a separate control. */}
        <Row style={styles.stackedRow}>
          <View style={styles.grow}>
            <AppText variant="label">Send me product updates</AppText>
            <AppText variant="caption">
              A few times a year at most, and you can turn this off here or from
              any email. Your reminders are separate and keep working either
              way.
            </AppText>
          </View>
          <Switch
            accessibilityLabel="Send me product updates"
            disabled={busyAction === "marketing"}
            ios_backgroundColor={colors.mist}
            onValueChange={(value) => void saveMarketing(value)}
            thumbColor={colors.paper}
            trackColor={{ false: colors.mist, true: colors.sageStrong }}
            value={marketingOptIn}
          />
        </Row>
      </Section>

      <Section title="Account and access">
        <Row>
          <View style={styles.grow}>
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
        </Row>
        <NavigationRow
          label="Set or change password"
          onPress={() => router.push("/reset-password")}
        />
        <Row>
          <TextAction label="Sign out" onPress={() => void auth.signOut()} />
        </Row>
      </Section>

      <Section title="About">
        <NavigationRow
          label="Privacy Policy"
          onPress={() => router.push("/legal/privacy")}
        />
        <NavigationRow
          label="Terms of Service"
          onPress={() => router.push("/legal/terms")}
        />
        <Row>
          <AppText variant="caption">
            {brand.name} {Constants.expoConfig?.version || "1.0.0"} · build{" "}
            {Constants.expoConfig?.ios?.buildNumber ||
              Constants.expoConfig?.android?.versionCode ||
              "development"}
          </AppText>
        </Row>
      </Section>

      <Section title="Your data">
        <AppText style={styles.sectionNote} variant="caption">
          Portable formats you control. Import merges by ID and never deletes
          what is already here.
        </AppText>
        <Row>
          <TextAction
            label="Export everything as JSON"
            loading={busyAction === "export-json"}
            onPress={() => void exportFormat("json")}
          />
        </Row>
        <Row>
          <TextAction
            label="Export contacts as CSV"
            loading={busyAction === "export-people-csv"}
            onPress={() => void exportFormat("people-csv")}
          />
        </Row>
        <Row>
          <TextAction
            label="Export updates as CSV"
            loading={busyAction === "export-updates-csv"}
            onPress={() => void exportFormat("updates-csv")}
          />
        </Row>
        <Row>
          <TextAction
            label="Choose JSON to import"
            loading={busyAction === "choose-import"}
            onPress={() => void chooseImport()}
          />
        </Row>
        {pendingImport ? (
          <View style={styles.importPreview}>
            <AppText variant="label">Ready to import</AppText>
            <AppText style={styles.muted} variant="caption">
              {pendingImport.preview.people} people ·{" "}
              {pendingImport.preview.updates} updates ·{" "}
              {pendingImport.preview.interactions} legacy interactions ·{" "}
              {pendingImport.preview.reminders} reminders ·{" "}
              {pendingImport.preview.tags} tags
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
      </Section>

      {message ? (
        <AppText style={styles.messageText} variant="caption">
          {message}
        </AppText>
      ) : null}
      {error ? (
        <AppText style={styles.errorText} variant="caption">
          {error}
        </AppText>
      ) : null}

      <Section title="Delete account">
        <AppText style={styles.sectionNote} variant="caption">
          Permanently removes every person, note, photo, update, interaction,
          reminder, subscription, and your sign-in identity.
        </AppText>
        <View style={styles.sectionAction}>
          <Button
            label="Delete account and data"
            loading={busyAction === "delete"}
            onPress={requestAccountDeletion}
            variant="danger"
          />
        </View>
      </Section>
    </Screen>
  );
}

function DeviceContactsSection() {
  const [enabled, setEnabled] = useState(false);
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [granted, setGranted] = useState(false);
  const [leftOver, setLeftOver] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setEnabled(await isContactSyncEnabled());
    const permission = await getContactsPermissionState();
    setGranted(permission.granted);
    setCanAskAgain(permission.canAskAgain);
    setLeftOver(await interruptedContactSyncCount());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function toggle(next: boolean) {
    if (!next) {
      await setContactSyncEnabled(false);
      setEnabled(false);
      return;
    }
    const outcome = await enableContactSyncWithExplainer();
    setEnabled(outcome === "granted");
    await refresh();
  }

  async function syncNow(restart: boolean) {
    setSyncing(true);
    try {
      await runFullContactSync({ restart });
    } finally {
      setSyncing(false);
      setLeftOver(await interruptedContactSyncCount());
    }
  }

  const blocked = enabled && !granted && !canAskAgain;

  return (
    <Section title="Device contacts">
      <Row>
        <View style={styles.grow}>
          <AppText variant="label">Add saved people to contacts</AppText>
          <AppText variant="caption">
            {enabled
              ? "People you add or edit are saved to your phone's Contacts app."
              : "Off. Nothing is read from or written to your contacts."}
          </AppText>
        </View>
        <Switch
          accessibilityLabel="Add saved people to contacts"
          onValueChange={(value) => void toggle(value)}
          trackColor={{ true: colors.ink, false: colors.mist }}
          value={enabled}
        />
      </Row>
      {blocked ? (
        <Row style={styles.stackedRow}>
          <AppText style={styles.grow} variant="caption">
            Your phone is blocking contacts access, and it won&rsquo;t ask
            again. Turn Contacts on for siyi in your device settings.
          </AppText>
          <TextAction
            label="Open Settings"
            onPress={() => void openDeviceSettings()}
          />
        </Row>
      ) : null}
      {enabled && granted ? (
        <Row>
          <TextAction
            label={
              leftOver > 0
                ? `Resume syncing (${leftOver} left)`
                : "Sync everyone now"
            }
            loading={syncing}
            onPress={() => void syncNow(leftOver === 0)}
          />
        </Row>
      ) : null}
    </Section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <SectionHeading title={title} />
      {children}
    </View>
  );
}

function Row({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}

function NavigationRow({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.grow}>
        <AppText variant="label">{label}</AppText>
        {detail ? <AppText variant="caption">{detail}</AppText> : null}
      </View>
      <CaretRight color={colors.inkMuted} size={17} />
    </Pressable>
  );
}

function TextAction({
  label,
  onPress,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <AppText style={loading ? styles.actionBusy : styles.action} variant="label">
        {loading ? "Working…" : label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: "center",
    flexDirection: "row",
    gap: 13,
  },
  identityMark: {
    alignItems: "center",
    backgroundColor: colors.ink,
    borderRadius: radii.round,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  identityInitial: {
    color: colors.paper,
    fontSize: 28,
    lineHeight: 31,
  },
  grow: {
    flex: 1,
  },
  section: {
    gap: 0,
  },
  sectionNote: {
    paddingBottom: 10,
    paddingTop: 2,
  },
  sectionAction: {
    paddingTop: 16,
  },
  suggestion: {
    alignItems: "flex-start",
    backgroundColor: colors.mist,
    borderRadius: radii.medium,
    gap: 9,
    marginTop: 12,
    padding: 12,
  },
  row: {
    alignItems: "center",
    borderTopColor: colors.mist,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 54,
    paddingVertical: 12,
  },
  stackedRow: {
    alignItems: "flex-start",
  },
  columnRow: {
    alignItems: "stretch",
    flexDirection: "column",
    gap: 10,
  },
  pressed: {
    opacity: 0.55,
  },
  daysField: {
    width: 72,
  },
  action: {
    color: colors.ink,
  },
  actionBusy: {
    color: colors.inkMuted,
  },
  importPreview: {
    borderTopColor: colors.mist,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingVertical: 14,
  },
  muted: {
    color: colors.inkMuted,
  },
  previewActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 4,
  },
  messageText: {
    color: colors.sageStrong,
  },
  errorText: {
    color: colors.coralStrong,
  },
});
