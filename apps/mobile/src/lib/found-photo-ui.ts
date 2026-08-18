import { storedPersonInput } from "@/lib/person-input";
import type { Person } from "@/lib/types";

/**
 * Offering a picture for someone who has none.
 *
 * The two places that can trigger it — saving an edited profile, and an update
 * that filled in an Instagram handle — both navigate away the moment they are
 * done, so a modal owned by either would unmount before it could be answered.
 * The one overlay host subscribes here instead, exactly as contact sync does.
 *
 * Everything here is quiet by design. Someone who already has a picture is
 * left alone, and a lookup that fails, times out, or finds nothing shows
 * nothing at all.
 */
export type FoundPhoto = {
  person: Person;
  uri: string;
  mimeType: string;
  source: "instagram" | "contacts";
};

export type FoundPhotoUiState = {
  offer: FoundPhoto | null;
  saving: boolean;
};

let state: FoundPhotoUiState = { offer: null, saving: false };
const listeners = new Set<() => void>();

function setState(next: Partial<FoundPhotoUiState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function getFoundPhotoUiState() {
  return state;
}

export function subscribeToFoundPhotoUi(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetFoundPhotoUi() {
  state = { offer: null, saving: false };
  for (const listener of listeners) listener();
}

/**
 * Looks for a picture and, if one turns up, puts the question on screen.
 * Instagram first because it is the handle that just changed; the address book
 * second, because a contact photo is worth offering even with no handle.
 */
/**
 * Where a picture can come from. Injected so the rules above can be tested
 * without an address book or a network, and so neither native module is
 * imported until a picture is actually being looked for — importing them at the
 * top drags the contacts permission into every screen that can trigger this.
 */
export type PhotoSources = {
  fromInstagram: (
    handle: string,
  ) => Promise<{ uri: string; mimeType: string } | null>;
  fromContacts: (person: Person) => Promise<string | null>;
};

const nativeSources: PhotoSources = {
  fromInstagram: async (handle) =>
    (await import("@/lib/instagram-avatar")).downloadInstagramAvatar(handle),
  fromContacts: async (person) =>
    (await import("@/lib/device-contacts")).findDeviceContactPhoto(person),
};

export async function offerFoundPhoto(
  person: Person,
  instagramHandle: string | null,
  sources: PhotoSources = nativeSources,
) {
  if (person.profilePhotoUrl) return;

  const instagram = instagramHandle?.trim()
    ? await sources.fromInstagram(instagramHandle)
    : null;
  if (instagram) {
    setState({
      offer: {
        person,
        uri: instagram.uri,
        mimeType: instagram.mimeType,
        source: "instagram",
      },
    });
    return;
  }

  const fromContacts = await sources.fromContacts(person);
  if (!fromContacts) return;
  setState({
    offer: {
      person,
      uri: fromContacts,
      mimeType: "image/jpeg",
      source: "contacts",
    },
  });
}

export function dismissFoundPhoto() {
  setState({ offer: null, saving: false });
}

export async function applyFoundPhoto(userId: string) {
  const { offer } = state;
  if (!offer) return;

  setState({ saving: true });
  try {
    const { updatePerson } = await import("@/lib/data");
    await updatePerson(
      userId,
      offer.person.id,
      storedPersonInput(offer.person),
      { uri: offer.uri, mimeType: offer.mimeType, fileName: "profile.jpg" },
      offer.person.profilePhotoPath,
    );
  } catch {
    // A picture nobody asked for is not worth an error message. It stays
    // unset, and can still be chosen by hand.
  } finally {
    setState({ offer: null, saving: false });
  }
}
