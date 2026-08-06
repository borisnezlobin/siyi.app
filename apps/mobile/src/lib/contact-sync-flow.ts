import { Alert } from "react-native";
import {
  hasBeenPromptedForContacts,
  isContactSyncEnabled,
  markContactsPrompted,
  requestContactsPermission,
  setContactSyncEnabled,
  syncPersonToDeviceContacts,
} from "@/lib/device-contacts";
import type { Person } from "@/lib/types";

function askToTurnOnSync(personName: string) {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      "Keep them in your contacts too?",
      `Siyi can add ${personName} to your phone's contacts, and keep adding the people you save. It only ever fills in blanks — it never changes details you already have.`,
      [
        {
          text: "Not now",
          style: "cancel",
          onPress: () => resolve(false),
        },
        { text: "Add to contacts", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Called after a person is saved. The very first save is what earns the right
 * to ask about contacts — never on launch, and never before there is something
 * worth syncing.
 */
export async function offerContactSyncAfterSave(person: Person) {
  if (await isContactSyncEnabled()) {
    await syncPersonToDeviceContacts(person);
    return;
  }

  if (await hasBeenPromptedForContacts()) return;

  const wantsSync = await askToTurnOnSync(
    person.preferredName || person.fullName,
  );
  if (!wantsSync) {
    await markContactsPrompted();
    return;
  }

  const granted = await requestContactsPermission();
  if (!granted) return;

  await setContactSyncEnabled(true);
  const result = await syncPersonToDeviceContacts(person);
  if (result.status === "failed") {
    Alert.alert("Contacts", result.message);
  }
}
