import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { colors, floatShadow, radii } from "@/constants/theme";
import {
  dismissContactSyncRun,
  dismissContactSyncToast,
  dismissContactsDeniedNotice,
  getContactSyncUiState,
  subscribeToContactSyncUi,
  type ContactSyncRunState,
} from "@/lib/contact-sync-ui";
import { openDeviceSettings } from "@/lib/device-contacts";

/**
 * The single place any contact-sync overlay is drawn. Mounted once above the
 * navigator so a sync started from a save handler still has somewhere to speak.
 */
export function ContactSyncOverlay() {
  const state = useSyncExternalStore(
    subscribeToContactSyncUi,
    getContactSyncUiState,
  );

  return (
    <>
      <ContactsAccessExplainer
        onAnswer={state.explainer?.resolve}
        visible={Boolean(state.explainer)}
      />
      <ContactsAccessBlockedNotice visible={state.showingDeniedNotice} />
      <ContactSyncRunDialog run={state.run} />
      {state.toast ? (
        <ContactSyncToast
          id={state.toast.id}
          key={state.toast.id}
          message={state.toast.message}
        />
      ) : null}
    </>
  );
}

export function ContactsAccessExplainer({
  visible,
  onAnswer,
}: {
  visible: boolean;
  onAnswer?: (accepted: boolean) => void;
}) {
  return (
    <Sheet onRequestClose={() => onAnswer?.(false)} visible={visible}>
      <AppText variant="title">Save your siyi people to Contacts</AppText>
      <View style={styles.paragraphs}>
        <AppText style={styles.body}>
          siyi can put the people you keep here into your phone&rsquo;s Contacts
          app — their name, phone numbers and email addresses — and keep them
          current as you edit them.
        </AppText>
        <AppText style={styles.body}>
          To do that without making duplicates, siyi reads your address book to
          find the person you already have. That happens entirely on this phone.
          Your contacts are never uploaded and never leave the device; all siyi
          keeps is a note of which contact goes with which person.
        </AppText>
        <AppText style={styles.body}>
          siyi only adds details that aren&rsquo;t there yet. A number or address
          already saved on a contact is left exactly as it is, and you&rsquo;ll
          see a count of anything it left alone.
        </AppText>
      </View>
      <AppText style={styles.footnote} variant="caption">
        Your phone will ask for permission next.
      </AppText>
      <View style={styles.actions}>
        <Button
          label="Not now"
          onPress={() => onAnswer?.(false)}
          variant="quiet"
        />
        <Button label="Continue" onPress={() => onAnswer?.(true)} />
      </View>
    </Sheet>
  );
}

function ContactsAccessBlockedNotice({ visible }: { visible: boolean }) {
  return (
    <Sheet onRequestClose={dismissContactsDeniedNotice} visible={visible}>
      <AppText variant="title">Contacts access is off</AppText>
      <View style={styles.paragraphs}>
        <AppText style={styles.body}>
          Your phone is set to keep siyi out of Contacts, and it won&rsquo;t ask
          again. Nothing is written to your contacts and nothing is read from
          them.
        </AppText>
        <AppText style={styles.body}>
          Everything else in siyi works exactly as before. If you change your
          mind, turn on Contacts for siyi in your device settings.
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button
          label="Not now"
          onPress={dismissContactsDeniedNotice}
          variant="quiet"
        />
        <Button
          label="Open Settings"
          onPress={() => {
            dismissContactsDeniedNotice();
            void openDeviceSettings();
          }}
        />
      </View>
    </Sheet>
  );
}

export function ContactSyncRunDialog({
  run,
}: {
  run: ContactSyncRunState | null;
}) {
  if (!run) return null;

  if (run.phase === "running") {
    const { completed, total, currentName } = run.progress;
    const share = total > 0 ? completed / total : 0;
    return (
      <Sheet visible>
        <AppText variant="title">Saving to Contacts</AppText>
        <AppText style={styles.body}>
          {completed} of {total}
          {currentName ? ` · ${currentName}` : ""}
        </AppText>
        <View
          accessibilityLabel={`Sync progress, ${completed} of ${total}`}
          accessibilityRole="progressbar"
          style={styles.track}
        >
          <View
            style={[styles.trackFill, { width: `${Math.round(share * 100)}%` }]}
          />
        </View>
        <AppText style={styles.footnote} variant="caption">
          You can leave this open. siyi picks up where it left off if you switch
          away.
        </AppText>
      </Sheet>
    );
  }

  const { summary } = run;
  return (
    <Sheet onRequestClose={dismissContactSyncRun} visible>
      <AppText variant="title">
        {summary.interrupted ? "Sync paused" : "Contacts are up to date"}
      </AppText>
      <View style={styles.tally}>
        <TallyRow label="Added to Contacts" value={summary.created} />
        <TallyRow label="Existing contacts filled in" value={summary.updated} />
        <TallyRow label="Left as they were" value={summary.skipped} />
      </View>
      <View style={styles.paragraphs}>
        {summary.alreadyComplete > 0 ? (
          <AppText style={styles.footnote} variant="caption">
            {summary.alreadyComplete}{" "}
            {summary.alreadyComplete === 1 ? "person" : "people"} already had
            everything siyi knows.
          </AppText>
        ) : null}
        {summary.conflicts > 0 ? (
          <AppText style={styles.footnote} variant="caption">
            {summary.conflicts}{" "}
            {summary.conflicts === 1 ? "detail" : "details"} on{" "}
            {summary.keptDeviceValue > 0 ? summary.keptDeviceValue : "some"} of
            your contacts differ from what siyi has. Yours were kept.
          </AppText>
        ) : null}
        {summary.failures.slice(0, 3).map((failure) => (
          <AppText key={failure.name} style={styles.failure} variant="caption">
            {failure.name}: {failure.message}
          </AppText>
        ))}
        {summary.failed > 3 ? (
          <AppText style={styles.failure} variant="caption">
            and {summary.failed - 3} more that could not be saved.
          </AppText>
        ) : null}
      </View>
      <View style={styles.actions}>
        <Button label="Done" onPress={dismissContactSyncRun} />
      </View>
    </Sheet>
  );
}

function TallyRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.tallyRow}>
      <AppText style={styles.tallyValue} variant="title">
        {value}
      </AppText>
      <AppText style={styles.tallyLabel}>{label}</AppText>
    </View>
  );
}

function ContactSyncToast({ id, message }: { id: number; message: string }) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const timer = setTimeout(() => dismissContactSyncToast(id), 3200);
    return () => clearTimeout(timer);
  }, [id]);

  return (
    <View
      pointerEvents="none"
      style={[styles.toastLayer, { bottom: insets.bottom + 96 }]}
    >
      <View style={styles.toast}>
        <AppText style={styles.toastText} variant="label">
          {message}
        </AppText>
      </View>
    </View>
  );
}

function Sheet({
  visible,
  onRequestClose,
  children,
}: {
  visible: boolean;
  onRequestClose?: () => void;
  children: ReactNode;
}) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onRequestClose}
      transparent
      visible={visible}
    >
      <View style={styles.scrim}>
        <View style={styles.sheet}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: "rgba(23, 32, 28, 0.45)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    ...floatShadow,
    backgroundColor: colors.paper,
    borderRadius: radii.large,
    gap: 16,
    padding: 26,
  },
  paragraphs: {
    gap: 12,
  },
  body: {
    color: colors.inkMuted,
  },
  footnote: {
    color: colors.inkMuted,
  },
  failure: {
    color: colors.coralStrong,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "flex-end",
  },
  track: {
    backgroundColor: colors.mist,
    borderRadius: radii.round,
    height: 6,
    overflow: "hidden",
  },
  trackFill: {
    backgroundColor: colors.ink,
    borderRadius: radii.round,
    height: 6,
  },
  tally: {
    gap: 14,
  },
  tallyRow: {
    alignItems: "baseline",
    flexDirection: "row",
    gap: 12,
  },
  tallyValue: {
    minWidth: 52,
  },
  tallyLabel: {
    flex: 1,
  },
  toastLayer: {
    alignItems: "center",
    left: 0,
    paddingHorizontal: 20,
    position: "absolute",
    right: 0,
  },
  toast: {
    ...floatShadow,
    backgroundColor: colors.ink,
    borderRadius: radii.round,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  toastText: {
    color: colors.paper,
    textAlign: "center",
  },
});
