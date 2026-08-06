import * as Haptics from "expo-haptics";
import { Check, Sparkle, X } from "phosphor-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
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
import { sharePersonCard } from "@/lib/share-contact";
import type { Person } from "@/lib/types";

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

  const fields = useMemo(
    () => availableContactShareFields(person),
    [person],
  );

  useEffect(() => {
    if (!visible) return;
    setSelection(defaultContactShareSelection);
    setBio(null);
  }, [person.id, visible]);

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
          </ScrollView>

          <Button
            label="Share contact card"
            onPress={() => void share()}
            loading={sharing}
          />
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
});
