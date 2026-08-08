import {
  BottomSheetScrollView,
  type BottomSheetModal,
} from "@gorhom/bottom-sheet";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  Check,
  Copy,
  Share as ShareIcon,
  Sparkle,
  X,
} from "phosphor-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppBottomSheet } from "@/components/app-bottom-sheet";
import { AppText } from "@/components/app-text";
import { Button } from "@/components/button";
import { colors, fontFamilies, radii } from "@/constants/theme";
import {
  availableContactShareFields,
  contactShareFieldLabels,
  defaultContactShareSelection,
  type ContactShareField,
  type ContactShareSelection,
} from "@/lib/contact-card";
import { onDeviceShortBio } from "@/lib/on-device-intelligence";
import { shareIsLive, type PersonShare } from "@/lib/person-share";
import {
  createPersonShare,
  listPersonShares,
  shareUrl,
} from "@/lib/person-share-data";
import type { Person } from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";

const sensitiveFields = new Set<ContactShareField>([
  "phoneNumber",
  "email",
  "notes",
]);

export function SharePersonSheet({
  person,
  visible,
  onClose,
}: {
  person: Person;
  visible: boolean;
  onClose: () => void;
}) {
  const [selection, setSelection] = useState<ContactShareSelection>(
    defaultContactShareSelection,
  );
  const [bio, setBio] = useState<string | null>(null);
  const [generatingBio, setGeneratingBio] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shares, setShares] = useState<PersonShare[]>([]);
  const [creatingLink, setCreatingLink] = useState(false);
  const [copied, setCopied] = useState(false);
  // Two taps can both land before the button re-renders as disabled, which is
  // how one press used to produce two links.
  const workingRef = useRef(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);

  const fields = useMemo(
    () => availableContactShareFields(person),
    [person],
  );

  const liveLink = useMemo(
    () => shares.find((entry) => shareIsLive(entry)) ?? null,
    [shares],
  );

  // Only so that a second tap reuses the link the first one made.
  const loadShares = useCallback(async () => {
    setShares(await listPersonShares(person.id));
  }, [person.id]);

  // Only on a change, never on the way in. Dismissing a sheet that has never
  // been presented does not no-op: the library has no early exit for a sheet in
  // its initial state, so it marks the sheet as dismissing, and from then on it
  // refuses to render. The sheet then swallowed every later present() and the
  // share button did nothing at all.
  const presented = useRef(false);
  useEffect(() => {
    if (visible === presented.current) return;
    presented.current = visible;
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setSelection(defaultContactShareSelection);
    setBio(null);
    setLinkError(null);
    void loadShares();
  }, [person.id, visible, loadShares]);

  const toggle = (field: ContactShareField) => {
    void Haptics.selectionAsync();
    setSelection((current) => ({ ...current, [field]: !current[field] }));
  };

  const toggleBio = async (enabled: boolean) => {
    setSelection((current) => ({ ...current, bio: enabled }));
    if (!enabled || bio) return;
    setGeneratingBio(true);
    try {
      setBio(await onDeviceShortBio(person));
    } finally {
      setGeneratingBio(false);
    }
  };

  const createLink = async () => {
    if (!userId || workingRef.current) return null;
    workingRef.current = true;
    setCreatingLink(true);
    setLinkError(null);

    try {
      const result = await createPersonShare({
        userId,
        personId: person.id,
        selection,
      });

      if (result.error || !result.share) {
        setLinkError(result.error ?? "That link couldn't be created.");
        return null;
      }

      setShares((current) => [result.share, ...current]);
      return result.share;
    } finally {
      workingRef.current = false;
      setCreatingLink(false);
    }
  };

  /** The live link if there is one, otherwise a fresh one. Never a second. */
  const ensureLink = async () => liveLink ?? (await createLink());

  const copyLink = async () => {
    const link = await ensureLink();
    if (!link) return;
    await Clipboard.setStringAsync(shareUrl(link));
    void Haptics.selectionAsync();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = async () => {
    const link = await ensureLink();
    if (!link) return;
    setSharing(true);
    try {
      await Share.share({ message: shareUrl(link) });
    } finally {
      setSharing(false);
    }
  };

  return (
    <AppBottomSheet onDismiss={onClose} ref={sheetRef}>
      <BottomSheetScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 24, 36) },
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <AppText style={styles.title}>
            Share {person.preferredName || person.fullName}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => sheetRef.current?.dismiss()}
            style={styles.close}
          >
            <X size={18} weight="bold" color={colors.ink} />
          </Pressable>
        </View>
        <AppText style={styles.subtitle}>
          Choose what goes on the card. Everything else stays with you.
        </AppText>

        <View style={styles.list}>
          {fields.map((field) => (
            <Pressable
              key={field}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selection[field] }}
              onPress={() => toggle(field)}
              style={styles.row}
            >
              <View
                style={[
                  styles.checkbox,
                  selection[field] && styles.checkboxOn,
                ]}
              >
                {selection[field] ? (
                  <Check size={13} weight="bold" color={colors.paper} />
                ) : null}
              </View>
              <View style={styles.rowText}>
                <AppText style={styles.rowLabel}>
                  {contactShareFieldLabels[field]}
                </AppText>
                {sensitiveFields.has(field) ? (
                  <AppText style={styles.rowHint}>Off by default</AppText>
                ) : null}
              </View>
            </Pressable>
          ))}

          <View style={styles.bioRow}>
            <View style={styles.rowText}>
              <View style={styles.bioLabel}>
                <Sparkle size={14} weight="fill" color={colors.sageStrong} />
                <AppText style={styles.rowLabel}>Short bio</AppText>
              </View>
              <AppText style={styles.rowHint}>
                Written on your device from public details only. Your notes
                are never used.
              </AppText>
            </View>
            <Switch
              value={selection.bio}
              onValueChange={(value) => void toggleBio(value)}
              trackColor={{ true: colors.sageStrong, false: colors.mist }}
            />
          </View>

          {selection.bio ? (
            <View style={styles.bioPreview}>
              {generatingBio ? (
                <ActivityIndicator color={colors.sageStrong} />
              ) : (
                <AppText style={styles.bioText}>
                  {bio ??
                    "No bio available on this device. The card will be shared without one."}
                </AppText>
              )}
            </View>
          ) : null}

        </View>

        <Button
          icon={Copy}
          label={copied ? "Copied" : "Copy link"}
          loading={creatingLink}
          onPress={() => void copyLink()}
        />
        <Button
          icon={ShareIcon}
          label="Share link"
          loading={sharing}
          onPress={() => void shareLink()}
          variant="secondary"
        />

        {linkError ? (
          <AppText style={styles.linkError}>{linkError}</AppText>
        ) : null}

        {liveLink ? (
          <AppText style={styles.linkReadout}>{shareUrl(liveLink)}</AppText>
        ) : null}
      </BottomSheetScrollView>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  rowText: { flex: 1, gap: 2 },
  rowLabel: {
    color: colors.ink,
    fontFamily: fontFamilies.bodySemibold,
    fontSize: 14,
  },
  linkReadout: {
    color: colors.inkMuted,
    fontFamily: fontFamilies.body,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  content: {
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    flex: 1,
    fontFamily: fontFamilies.display,
    fontSize: 24,
    // The display face is drawn taller than its point size, so the default
    // line height clips the top of the capitals.
    lineHeight: 32,
    paddingTop: 2,
    color: colors.ink,
  },
  close: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.round,
    backgroundColor: colors.mist,
  },
  subtitle: { fontSize: 13, lineHeight: 19, color: colors.inkMuted },
  list: { gap: 4, paddingVertical: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: radii.medium,
    backgroundColor: colors.paper,
  },
  checkbox: {
    width: 21,
    height: 21,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    backgroundColor: colors.mist,
  },
  checkboxOn: { backgroundColor: colors.coral },
  rowHint: { fontSize: 11, lineHeight: 16, color: colors.inkMuted },
  bioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: radii.medium,
    backgroundColor: colors.paper,
  },
  bioLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  bioPreview: {
    padding: 14,
    borderRadius: radii.medium,
    backgroundColor: colors.sage,
  },
  bioText: { fontSize: 13, lineHeight: 19, color: colors.ink },
  linkError: { fontSize: 12, lineHeight: 17, color: colors.coralStrong },
});
