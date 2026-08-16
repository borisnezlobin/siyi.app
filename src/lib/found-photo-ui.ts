"use client";

import { findInstagramPhoto } from "@/lib/found-photo-client";

/**
 * Offering a picture for someone who has none.
 *
 * The place that triggers it — saving a newly added person — navigates to that
 * person the moment it is done, so a dialog owned by the form would unmount
 * before it could be answered. One host up in the shell subscribes here
 * instead, exactly as the phone's overlay does.
 *
 * Everything here is quiet by design. Someone who already has a picture is
 * left alone, and a lookup that fails, times out, or finds nothing shows
 * nothing at all.
 */
export type FoundPhotoOffer = {
  personId: string;
  photo: Blob;
};

export type FoundPhotoUiState = {
  offer: FoundPhotoOffer | null;
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

export async function offerFoundPhoto(
  personId: string,
  instagramHandle: string | null,
  lookUp: (handle: string) => Promise<Blob | null> = findInstagramPhoto,
) {
  if (!instagramHandle?.trim()) return;
  const photo = await lookUp(instagramHandle);
  if (photo) setState({ offer: { personId, photo } });
}

export function setFoundPhotoSaving(saving: boolean) {
  setState({ saving });
}

export function dismissFoundPhoto() {
  setState({ offer: null, saving: false });
}

export function resetFoundPhotoUi() {
  state = { offer: null, saving: false };
  for (const listener of listeners) listener();
}
