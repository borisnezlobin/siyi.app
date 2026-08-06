import type {
  ContactSyncProgress,
  ContactSyncSummary,
} from "@/lib/device-contacts";

/**
 * Contact sync is started from places that cannot render — a save handler, a
 * settings switch — so the one overlay host subscribes here and every entry
 * point talks to this store instead of owning its own modal.
 */
export type ContactSyncUiState = {
  /** Resolves when the user answers the explainer, before the OS is asked. */
  explainer: { resolve: (accepted: boolean) => void } | null;
  /** The OS will not ask again; only device settings can turn this back on. */
  showingDeniedNotice: boolean;
  run: ContactSyncRunState | null;
  toast: { id: number; message: string } | null;
};

export type ContactSyncRunState =
  | { phase: "running"; progress: ContactSyncProgress }
  | { phase: "done"; summary: ContactSyncSummary };

let state: ContactSyncUiState = {
  explainer: null,
  showingDeniedNotice: false,
  run: null,
  toast: null,
};

const listeners = new Set<() => void>();
let nextToastId = 1;

function setState(next: Partial<ContactSyncUiState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function getContactSyncUiState() {
  return state;
}

export function subscribeToContactSyncUi(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetContactSyncUi() {
  state = {
    explainer: null,
    showingDeniedNotice: false,
    run: null,
    toast: null,
  };
  for (const listener of listeners) listener();
}

/**
 * Shows what access will be used for and waits for an answer. The OS prompt is
 * a one-shot, so nothing may request it until this resolves true.
 */
export function askAboutContactsAccess() {
  return new Promise<boolean>((resolve) => {
    if (state.explainer) {
      resolve(false);
      return;
    }
    setState({
      explainer: {
        resolve: (accepted) => {
          setState({ explainer: null });
          resolve(accepted);
        },
      },
    });
  });
}

export function showContactsDeniedNotice() {
  setState({ showingDeniedNotice: true });
}

export function dismissContactsDeniedNotice() {
  setState({ showingDeniedNotice: false });
}

export function startContactSyncRun(progress: ContactSyncProgress) {
  setState({ run: { phase: "running", progress } });
}

export function updateContactSyncRun(progress: ContactSyncProgress) {
  if (state.run?.phase !== "running") return;
  setState({ run: { phase: "running", progress } });
}

export function finishContactSyncRun(summary: ContactSyncSummary) {
  setState({ run: { phase: "done", summary } });
}

export function dismissContactSyncRun() {
  setState({ run: null });
}

export function showContactSyncToast(message: string) {
  setState({ toast: { id: nextToastId++, message } });
}

export function dismissContactSyncToast(id: number) {
  if (state.toast?.id !== id) return;
  setState({ toast: null });
}
