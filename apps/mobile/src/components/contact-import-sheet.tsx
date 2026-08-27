import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText } from "@/components/app-text";
import {
  AppBottomSheet,
  AppBottomSheetScrollView,
} from "@/components/app-bottom-sheet";
import { Button } from "@/components/button";
import { FormField } from "@/components/form-field";
import { colors, radii } from "@/constants/theme";
import { avatarInitials } from "@/lib/avatar-colors";
import {
  getContactsPermissionState,
  openDeviceSettings,
  readDeviceContactsForImport,
  requestContactsPermission,
  type ImportableContact,
} from "@/lib/device-contacts";

/**
 * Picking someone out of the address book to start a new person from.
 *
 * Permission is asked for here and nowhere earlier. The review notes promise
 * Apple that contacts access is offered rather than demanded, behind an
 * explanation shown before the system prompt, and that declining leaves every
 * other feature working — so this sheet explains itself first, and closing it
 * costs the user nothing.
 *
 * Nothing is written to the address book and nothing leaves the device here.
 * The chosen contact only fills in fields the user can still edit or clear.
 */

// Address books run to thousands of entries and this list lives inside a
// sheet. Showing the first slice and letting the search narrow it keeps the
// sheet responsive without paging machinery nobody would notice.
const visibleLimit = 40;

export function ContactImportSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (contact: ImportableContact) => void;
}) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const [permission, setPermission] = useState<
    "undetermined" | "granted" | "denied"
  >("undetermined");
  const [contacts, setContacts] = useState<ImportableContact[] | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) sheetRef.current?.present();
    else sheetRef.current?.dismiss();
  }, [visible]);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setContacts(await readDeviceContactsForImport());
    } catch {
      setError("Your contacts could not be read.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Only ever reads the current state here. Asking on open would be the prompt
  // arriving before the explanation, which is the thing this sheet exists to
  // avoid.
  useEffect(() => {
    if (!visible) return;
    let stillOpen = true;
    void getContactsPermissionState().then((state) => {
      if (!stillOpen) return;
      const granted = state.granted;
      setPermission(granted ? "granted" : state.canAskAgain ? "undetermined" : "denied");
      if (granted) void load();
    });
    return () => {
      stillOpen = false;
    };
  }, [visible, load]);

  async function allow() {
    setBusy(true);
    try {
      const granted = await requestContactsPermission();
      setPermission(granted ? "granted" : "denied");
      if (granted) await load();
    } finally {
      setBusy(false);
    }
  }

  const matches = useMemo(() => {
    if (!contacts) return [];
    const needle = query.trim().toLowerCase();
    if (!needle) return contacts.slice(0, visibleLimit);
    return contacts
      .filter(
        (contact) =>
          contact.name.toLowerCase().includes(needle) ||
          contact.phoneNumbers.some((phone) => phone.includes(needle)) ||
          contact.emails.some((email) => email.toLowerCase().includes(needle)),
      )
      .slice(0, visibleLimit);
  }, [contacts, query]);

  function choose(contact: ImportableContact) {
    onPick(contact);
    sheetRef.current?.dismiss();
  }

  return (
    <AppBottomSheet onDismiss={onClose} ref={sheetRef}>
      <AppBottomSheetScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <AppText variant="heading">Import from Contacts</AppText>
          <AppText style={styles.muted}>
            Pick someone and we will fill in what your address book already
            knows. You can change any of it before saving.
          </AppText>
        </View>

        {permission === "undetermined" ? (
          <View style={styles.explain}>
            <AppText style={styles.muted}>
              We read your contacts on this device to fill in a name, number,
              email, birthday, and picture. Nothing is uploaded, and nothing is
              added to your address book.
            </AppText>
            <Button label="Allow contacts" loading={busy} onPress={() => void allow()} />
          </View>
        ) : null}

        {permission === "denied" ? (
          <View style={styles.explain}>
            <AppText style={styles.muted}>
              Contacts are blocked in device settings. You can still add
              someone by typing their details.
            </AppText>
            <Button
              label="Open device settings"
              onPress={() => void openDeviceSettings()}
              variant="quiet"
            />
          </View>
        ) : null}

        {permission === "granted" ? (
          <>
            <FormField
              autoCapitalize="none"
              bottomSheet
              label="Search contacts"
              onChangeText={setQuery}
              placeholder="Name, number, or email"
              value={query}
            />
            {error ? (
              <AppText style={styles.error} variant="caption">
                {error}
              </AppText>
            ) : null}
            {busy && !contacts ? (
              <AppText style={styles.muted}>Reading your contacts…</AppText>
            ) : null}
            {contacts && matches.length === 0 ? (
              <AppText style={styles.muted}>
                {query.trim()
                  ? "Nobody here matches that."
                  : "This device has no contacts to import."}
              </AppText>
            ) : null}
            {matches.map((contact) => (
              <Pressable
                accessibilityRole="button"
                key={contact.id}
                onPress={() => choose(contact)}
                style={styles.row}
              >
                {contact.imageUri ? (
                  <Image alt="" source={{ uri: contact.imageUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <AppText variant="label">{avatarInitials(contact.name)}</AppText>
                  </View>
                )}
                <View style={styles.rowText}>
                  <AppText>{contact.name}</AppText>
                  {contact.phoneNumbers[0] || contact.emails[0] ? (
                    <AppText style={styles.muted} variant="caption">
                      {contact.phoneNumbers[0] || contact.emails[0]}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            ))}
            {contacts && contacts.length > matches.length && !query.trim() ? (
              <AppText style={styles.muted} variant="caption">
                {`Showing ${matches.length} of ${contacts.length}. Search to narrow it down.`}
              </AppText>
            ) : null}
          </>
        ) : null}
      </AppBottomSheetScrollView>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingBottom: 12 },
  header: { gap: 6 },
  explain: { gap: 12 },
  muted: { color: colors.inkMuted },
  error: { color: colors.coralStrong },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingVertical: 8,
  },
  rowText: { flex: 1, gap: 2 },
  avatar: {
    borderRadius: radii.round,
    height: 40,
    width: 40,
  },
  avatarFallback: {
    alignItems: "center",
    backgroundColor: colors.mist,
    justifyContent: "center",
  },
});
