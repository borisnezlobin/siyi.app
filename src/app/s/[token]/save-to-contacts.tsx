"use client";

import { DownloadSimple } from "@phosphor-icons/react";

/**
 * The card text is built on the server from the sharer's selection, so nothing
 * here can widen what the link exposes.
 */
export function SaveToContactsButton({
  card,
  fileName,
  personName,
}: {
  card: string;
  fileName: string;
  personName: string;
}) {
  async function save() {
    const file = new File([card], fileName, { type: "text/vcard" });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: personName });
        return;
      } catch {
        // Dismissed; fall through to a plain download.
      }
    }

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={() => void save()}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-ink px-6 text-sm font-semibold text-white transition-colors hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
    >
      <DownloadSimple size={17} weight="bold" aria-hidden="true" />
      Save to contacts
    </button>
  );
}
