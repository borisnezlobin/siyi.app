import * as Haptics from "expo-haptics";
import { Check, LinkSimple, Sparkle, X } from "phosphor-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  View,
} from "react-native";
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
import {
  defaultShareExpiryChoiceId,
  shareExpiryChoices,
  type PersonShare,
  type ShareExpiryChoiceId,
} from "@/lib/person-share";
import {
  createPersonShare,
  listPersonShares,
  revokePersonShare,
  shareUrl,
} from "@/lib/person-share-data";
import { sharePersonCard } from "@/lib/share-contact";
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
  const [expiry, setExpiry] = useState<ShareExpiryChoiceId>(
    defaultShareExpiryChoiceId,
  );
  // Null while we are still finding out. Links stay hidden until we know the
  // table exists, so a build that ships before migration 0015 simply offers the
  // contact card, exactly as before.
  const [linksAvailable, setLinksAvailable] = useState<boolean | null>(null);
  const [shares, setShares] = useState<PersonShare[]>([]);
  const [creatingLink, setCreatingLink] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const fields = useMemo(
    () => availableContactShareFields(person),
    [person],
  );

  const loadShares = useCallback(async () => {
    const result = await listPersonShares(person.id);
    setLinksAvailable(result.available);
    setShares(result.shares);
  }, [person.id]);

  useEffect(() => {
    if (!visible) return;
    setSelection(defaultContactShareSelection);
    setBio(null);
    setExpiry(defaultShareExpiryChoiceId);
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

  const share = async () => {
    setSharing(true);
    try {
      await sharePersonCard(person, selection, bio);
      onClose();
    } finally {
      setSharing(false);
    }
  };

  const sendLink = async (personShare: PersonShare) => {
    await Share.share({
      url: shareUrl(personShare),
      message: shareUrl(personShare),
      title: person.preferredName || person.fullName,
    });
  };

  const createLink = async () => {
    if (!userId) return;
    setCreatingLink(true);
    setLinkError(null);

    try {
      const result = await createPersonShare({
        userId,
        personId: person.id,
        selection,
        expiry,
      });

      if (result.unavailable) {
        setLinksAvailable(false);
        return;
      }
      if (result.error || !result.share) {
        setLinkError(result.error ?? "That link couldn't be created.");
        return;
      }

      setShares((current) => [result.share, ...current]);
      await sendLink(result.share);
    } finally {
      setCreatingLink(false);
    }
  };

  const revokeLink = async (personShare: PersonShare) => {
    void Haptics.selectionAsync();
    setShares((current) =>
      current.filter((entry) => entry.id !== personShare.id),
    );
    if (!(await revokePersonShare(personShare.id))) {
      setLinkError("We couldn't turn that link off. Try again in a moment.");
      await loadShares();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <AppText style={styles.title}>
              Share {person.preferredName || person.fullName}
            </AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={styles.close}
            >
              <X size={18} weight="bold" color={colors.ink} />
            </Pressable>
          </View>
          <AppText style={styles.subtitle}>
            Choose what goes on the card. Everything else stays with you.
          </AppText>

          <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
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

            {linksAvailable ? (
              <View style={styles.linkSection}>
                <AppText style={styles.linkHeading}>Or send a link</AppText>
                <AppText style={styles.rowHint}>
                  A page on siyi.app showing only what you ticked above. Anyone
                  with the link can open it, so it expires by default.
                </AppText>

                <View style={styles.expiryRow}>
                  {shareExpiryChoices.map((choice) => (
                    <Pressable
                      key={choice.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: expiry === choice.id }}
                      accessibilityLabel={choice.label}
                      onPress={() => setExpiry(choice.id)}
                      style={[
                        styles.expiryChip,
                        expiry === choice.id && styles.expiryChipOn,
                      ]}
                    >
                      <AppText
                        style={[
                          styles.expiryLabel,
                          expiry === choice.id && styles.expiryLabelOn,
                        ]}
                      >
                        {choice.label}
                      </AppText>
                    </Pressable>
                  ))}
                </View>

                {shares.map((personShare) => (
                  <View key={personShare.id} style={styles.linkRow}>
                    <View style={styles.rowText}>
                      <AppText style={styles.rowLabel}>
                        /s/{personShare.token.slice(0, 8)}…
                      </AppText>
                      <AppText style={styles.rowHint}>
                        {personShare.expiresAt
                          ? `Expires ${new Date(
                              personShare.expiresAt,
                            ).toLocaleDateString()}`
                          : "No expiry"}
                      </AppText>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Send link"
                      onPress={() => void sendLink(personShare)}
                      style={styles.linkAction}
                    >
                      <AppText style={styles.linkActionLabel}>Send</AppText>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Turn off link"
                      onPress={() => void revokeLink(personShare)}
                      style={styles.linkAction}
                    >
                      <AppText style={styles.linkActionLabel}>Turn off</AppText>
                    </Pressable>
                  </View>
                ))}

                {linkError ? (
                  <AppText style={styles.linkError}>{linkError}</AppText>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <Button
            label="Share contact card"
            onPress={() => void share()}
            loading={sharing}
          />
          {linksAvailable ? (
            <Button
              icon={LinkSimple}
              label="Create a link"
              onPress={() => void createLink()}
              loading={creatingLink}
              variant="secondary"
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(23, 32, 28, 0.4)",
  },
  sheet: {
    maxHeight: "88%",
    padding: 22,
    paddingBottom: 34,
    gap: 12,
    backgroundColor: colors.porcelain,
    borderTopLeftRadius: radii.xlarge,
    borderTopRightRadius: radii.xlarge,
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
  list: { flexGrow: 0 },
  listInner: { gap: 4, paddingVertical: 4 },
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
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: fontFamilies.bodySemibold, fontSize: 14, color: colors.ink },
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
  linkSection: {
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.mist,
  },
  linkHeading: {
    fontFamily: fontFamilies.bodySemibold,
    fontSize: 14,
    color: colors.ink,
  },
  expiryRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  expiryChip: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: radii.round,
    backgroundColor: colors.paper,
  },
  expiryChipOn: { backgroundColor: colors.ink },
  expiryLabel: {
    fontFamily: fontFamilies.bodySemibold,
    fontSize: 12,
    color: colors.inkMuted,
  },
  expiryLabelOn: { color: colors.paper },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radii.medium,
    backgroundColor: colors.paper,
  },
  linkAction: { paddingVertical: 6, paddingHorizontal: 8 },
  linkActionLabel: {
    fontFamily: fontFamilies.bodySemibold,
    fontSize: 12,
    color: colors.inkMuted,
  },
  linkError: { fontSize: 12, lineHeight: 17, color: colors.coralStrong },
});
