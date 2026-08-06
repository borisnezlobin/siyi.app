import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  buildVCard,
  contactCardFileName,
  type ContactShareSelection,
} from "@/lib/contact-card";
import type { Person } from "@/lib/types";

const shareDirectory = new Directory(Paths.cache, "siyi-shared-contacts");

export async function sharePersonCard(
  person: Person,
  selection: ContactShareSelection,
  bio: string | null,
) {
  if (!(await Sharing.isAvailableAsync())) return false;

  if (!shareDirectory.exists) {
    shareDirectory.create({ idempotent: true, intermediates: true });
  }

  const file = new File(shareDirectory, contactCardFileName(person));
  file.write(buildVCard(person, selection, { bio }));

  await Sharing.shareAsync(file.uri, {
    mimeType: "text/vcard",
    UTI: "public.vcard",
    dialogTitle: `Share ${person.preferredName || person.fullName}`,
  });

  return true;
}

/** The card is a temporary artefact; it should not linger in the cache. */
export function clearSharedContactFiles() {
  if (!shareDirectory.exists) return;
  for (const entry of shareDirectory.list()) entry.delete();
}
