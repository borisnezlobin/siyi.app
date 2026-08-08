import type { UpdateProposal } from "@/lib/update-proposal";

/**
 * Choosing which brain sorts an update.
 *
 * The phone's own model goes first whenever it exists: it works with no signal,
 * costs nothing, and nothing about the person leaves the device. The server is
 * the fallback for everything older, and for Android.
 *
 * Written against injected functions so the order — which is the whole of the
 * logic here — can be tested without a model or a network.
 */

export type ClassifierSource = "device" | "server" | "none";

export type ClassifyResult = {
  proposal: UpdateProposal | null;
  source: ClassifierSource;
};

export async function classifyUpdate({
  context,
  text,
  onDevice,
  onServer,
}: {
  context: string;
  text: string;
  onDevice: (input: { context: string; text: string }) => Promise<UpdateProposal | null>;
  onServer: (() => Promise<UpdateProposal | null>) | null;
}): Promise<ClassifyResult> {
  try {
    const local = await onDevice({ context, text });
    if (local) return { proposal: local, source: "device" };
  } catch {
    // Fall through: an unusable model on this device is the server's cue.
  }

  if (!onServer) return { proposal: null, source: "none" };

  try {
    const remote = await onServer();
    if (remote) return { proposal: remote, source: "server" };
  } catch {
    // Offline, or the key is not set. Saved as plain words instead.
  }

  return { proposal: null, source: "none" };
}

/** Said in the sheet, so it is never a mystery where the sorting happened. */
export function sourceLabel(source: ClassifierSource): string | null {
  if (source === "device") return "Sorted on your phone";
  if (source === "server") return "Sorted by Siyi";
  return null;
}
