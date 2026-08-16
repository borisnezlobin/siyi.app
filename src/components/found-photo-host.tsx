"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { FoundPhotoDialog } from "@/components/found-photo-dialog";
import { saveFoundPhoto } from "@/lib/found-photo-client";
import {
  dismissFoundPhoto,
  getFoundPhotoUiState,
  setFoundPhotoSaving,
  subscribeToFoundPhotoUi,
} from "@/lib/found-photo-ui";

const emptyState = { offer: null, saving: false };

/**
 * Sits in the shell rather than in any page, because the form that asks for a
 * picture navigates away the instant it has saved.
 */
export function FoundPhotoHost() {
  const router = useRouter();
  const state = useSyncExternalStore(
    subscribeToFoundPhotoUi,
    getFoundPhotoUiState,
    () => emptyState,
  );
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // The object URL is revoked when the offer goes away; building one inline in
  // the render would leak a new one on every keystroke elsewhere on the page.
  useEffect(() => {
    if (!state.offer) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(state.offer.photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [state.offer]);

  async function keep() {
    if (!state.offer) return;
    setFoundPhotoSaving(true);
    await saveFoundPhoto(state.offer.personId, state.offer.photo);
    dismissFoundPhoto();
    router.refresh();
  }

  return (
    <FoundPhotoDialog
      onDismiss={dismissFoundPhoto}
      onUse={() => void keep()}
      photoUrl={photoUrl}
      saving={state.saving}
    />
  );
}
