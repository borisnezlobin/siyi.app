"use client";

import {
  Check,
  Plus,
  X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { interactionOptions } from "@/lib/interaction-options";
import type { InteractionType } from "@/lib/types";

type QuickInteractionSheetProps = {
  personId: string;
  personName: string;
  buttonLabel?: string;
  compact?: boolean;
};

export function QuickInteractionSheet({
  personId,
  personName,
  buttonLabel = "Add update",
  compact = false,
}: QuickInteractionSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedType, setSelectedType] = useState<InteractionType>("texted");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      setNote("");
      setSaved(false);
    };

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  async function saveInteraction() {
    setSaving(true);

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId,
          type: selectedType,
          occurredAt: new Date().toISOString(),
          note,
        }),
      });

      if (!response.ok) {
        setSaving(false);
        return;
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }

    setSaving(false);
    setSaved(true);
    window.setTimeout(() => dialogRef.current?.close(), 650);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={clsx(
          "inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2",
          compact
            ? "relative z-10 size-10 shrink-0 rounded-full bg-sage text-sage-strong hover:bg-[#d3e1d7]"
            : "rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-card hover:bg-[#28332e]",
        )}
        aria-label={compact ? `Add an update about ${personName}` : undefined}
      >
        <Plus size={compact ? 18 : 17} weight="bold" aria-hidden="true" />
        {!compact ? buttonLabel : null}
      </button>

      <dialog
        ref={dialogRef}
        className="m-0 mt-auto max-h-[88vh] w-full max-w-none overflow-visible rounded-t-[2rem] bg-white p-0 text-ink shadow-float backdrop:bg-ink/40 sm:m-auto sm:w-[440px] sm:rounded-[2rem]"
        aria-labelledby={`quick-log-${personId}`}
      >
        <div className="max-h-[88vh] overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 sm:p-6">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/12 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-coral-strong">Quick log</p>
              <h2
                id={`quick-log-${personId}`}
                className="mt-1 font-display text-3xl leading-none"
              >
                Time with {personName}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="grid size-10 place-items-center rounded-full bg-mist text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              aria-label="Close update sheet"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold">What did you do?</legend>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {interactionOptions.map(({ value, label, icon: Icon }) => {
                const active = selectedType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSelectedType(value)}
                    className={clsx(
                      "flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                      active
                        ? "bg-sage text-sage-strong shadow-card"
                        : "bg-porcelain text-ink-muted hover:bg-mist",
                    )}
                    aria-pressed={active}
                  >
                    <Icon size={22} weight={active ? "fill" : "regular"} aria-hidden="true" />
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="mt-5 block text-sm font-semibold" htmlFor={`note-${personId}`}>
            Add a note <span className="font-normal text-ink-muted">(optional)</span>
          </label>
          <textarea
            id={`note-${personId}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What do you want to remember?"
            className="mt-2 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20"
          />

          <button
            type="button"
            onClick={saveInteraction}
            disabled={saving || saved}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 py-4 text-sm font-semibold text-white shadow-float transition-colors hover:bg-coral-strong disabled:cursor-wait disabled:bg-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            {saved ? (
              <>
                <Check size={18} weight="bold" aria-hidden="true" />
                Logged
              </>
            ) : saving ? (
              "Saving…"
            ) : (
              "Save update"
            )}
          </button>
        </div>
      </dialog>
    </>
  );
}
