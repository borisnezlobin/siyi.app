import { useSyncExternalStore } from "react";
import { FoundPhotoSheet } from "@/components/found-photo-sheet";
import {
  dismissFoundPhoto,
  getFoundPhotoUiState,
  subscribeToFoundPhotoUi,
  applyFoundPhoto,
} from "@/lib/found-photo-ui";
import { useAuth } from "@/providers/auth-provider";

/**
 * Mounted once above the navigator, because the screens that ask for a picture
 * navigate away the moment they have asked.
 */
export function FoundPhotoOverlay() {
  const state = useSyncExternalStore(
    subscribeToFoundPhotoUi,
    getFoundPhotoUiState,
  );
  const { session } = useAuth();

  return (
    <FoundPhotoSheet
      onDismiss={dismissFoundPhoto}
      onUse={() => {
        if (session) void applyFoundPhoto(session.user.id);
      }}
      photoUri={state.offer?.uri ?? null}
      saving={state.saving}
      source={state.offer?.source ?? "instagram"}
      visible={Boolean(state.offer)}
    />
  );
}
