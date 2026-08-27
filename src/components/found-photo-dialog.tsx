"use client";

import { useEffect, useRef } from "react";

/**
 * Offered, never applied.
 *
 * A picture found somewhere else is a guess about who someone is, so it is
 * shown before it is saved. Nothing is drawn at all unless there is a picture
 * to show — a lookup that failed or found nothing leaves the page as it was.
 */
export function FoundPhotoDialog({
  photoUrl,
  saving,
  onUse,
  onDismiss,
}: {
  photoUrl: string | null;
  saving: boolean;
  onUse: () => void;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (photoUrl && !dialog.open) dialog.showModal();
    if (!photoUrl && dialog.open) dialog.close();
  }, [photoUrl]);

  if (!photoUrl) return null;

  return (
    <dialog
      ref={dialogRef}
      onClose={onDismiss}
      className="m-auto w-[min(380px,calc(100vw-2rem))] rounded-[1.75rem] bg-white p-6 text-ink shadow-float backdrop:bg-ink/40"
      aria-labelledby="found-photo-title"
    >
      <h2 id="found-photo-title" className="font-display text-2xl leading-tight">
        Save profile picture?
      </h2>
      <p className="mt-2 text-sm leading-6 text-ink-muted">
        Siyi found this profile picture on Instagram. Use it?
      </p>

      <div className="mt-5 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt="The profile picture Siyi found"
          className="size-32 rounded-full bg-mist object-cover"
        />
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold text-ink-muted transition-colors hover:bg-ink/[0.05] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          Don&rsquo;t use
        </button>
        <button
          type="button"
          onClick={onUse}
          disabled={saving}
          className="inline-flex min-h-11 items-center rounded-xl bg-coral px-5 text-sm font-semibold text-white transition-colors hover:bg-coral-strong disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          {saving ? "Saving…" : "Use"}
        </button>
      </div>
    </dialog>
  );
}
