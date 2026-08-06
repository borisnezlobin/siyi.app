import { getPeople } from "@/lib/data";
import {
  askAboutContactsAccess,
  finishContactSyncRun,
  showContactSyncToast,
  showContactsDeniedNotice,
  startContactSyncRun,
  updateContactSyncRun,
} from "@/lib/contact-sync-ui";
import {
  getContactsPermissionState,
  hasBeenPromptedForContacts,
  isContactSyncEnabled,
  markContactsPrompted,
  requestContactsPermission,
  setContactSyncEnabled,
  syncAllPeopleToDeviceContacts,
  syncPersonToDeviceContacts,
} from "@/lib/device-contacts";
import type { Person } from "@/lib/types";

/**
 * The explainer always comes first: a permission prompt the user declines can
 * never be shown again, so the reason has to arrive while refusing still costs
 * them nothing.
 */
export async function requestContactsAccessWithExplainer() {
  const before = await getContactsPermissionState();
  if (before.granted) return "granted" as const;

  if (!before.canAskAgain) {
    await markContactsPrompted();
    showContactsDeniedNotice();
    return "blocked" as const;
  }

  if (!(await askAboutContactsAccess())) {
    await markContactsPrompted();
    return "declined" as const;
  }

  const after = await requestContactsPermission();
  if (after.granted) return "granted" as const;

  showContactsDeniedNotice();
  return after.canAskAgain ? ("declined" as const) : ("blocked" as const);
}

/**
 * Turns sync on from nothing: explain, ask, then bring the whole address book
 * up to date in one visible pass.
 */
export async function enableContactSyncWithExplainer() {
  const outcome = await requestContactsAccessWithExplainer();
  if (outcome !== "granted") return outcome;

  await setContactSyncEnabled(true);
  void runFullContactSync();
  return outcome;
}

export async function runFullContactSync(options: { restart?: boolean } = {}) {
  const people = await getPeople();
  startContactSyncRun({
    completed: 0,
    total: people.length,
    currentName: null,
    tally: {
      total: people.length,
      created: 0,
      updated: 0,
      skipped: 0,
      alreadyComplete: 0,
      keptDeviceValue: 0,
      failed: 0,
      conflicts: 0,
    },
  });

  const summary = await syncAllPeopleToDeviceContacts(people, {
    onProgress: updateContactSyncRun,
    restart: options.restart,
  });
  finishContactSyncRun(summary);
  return summary;
}

/**
 * Called after a person is saved. The very first save is what earns the right
 * to ask about contacts — never on launch, and never before there is something
 * worth syncing.
 */
export async function offerContactSyncAfterSave(person: Person) {
  if (await isContactSyncEnabled()) {
    const result = await syncPersonToDeviceContacts(person);
    const name = person.preferredName || person.fullName;
    if (result.status === "created") {
      showContactSyncToast(`${name} added to your contacts`);
    } else if (result.status === "updated") {
      showContactSyncToast(`Contacts updated for ${name}`);
    } else if (result.status === "failed") {
      showContactSyncToast(`Contacts could not be updated: ${result.message}`);
    }
    return;
  }

  // Sync is off on purpose, or the offer has already been made and turned
  // down. Either way this is not the moment to ask again.
  if (await hasBeenPromptedForContacts()) return;

  await enableContactSyncWithExplainer();
}
