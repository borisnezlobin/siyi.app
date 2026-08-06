"use client";

import { Check, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  timestampFromDateInput,
  toDateInputValue,
  todayDateInputValue,
} from "@/lib/date-input";
import { interactionOptions } from "@/lib/interaction-options";
import type { InteractionType } from "@/lib/types";

export type EditableEntry = {
  kind: "update" | "interaction";
  id: string;
  type: InteractionType;
  body: string;
  at: string;
};

type UpdateSheetProps = {
  personId: string;
  personName: string;
  variant?: "primary" | "compact" | "edit";
  buttonLabel?: string;
  entry?: EditableEntry;
};

const isPreviewOnly = () => !process.env.NEXT_PUBLIC_SUPABASE_URL;

export function UpdateSheet({
  personId,
  personName,
  variant = "primary",
  buttonLabel = "Add update",
  entry,
}: UpdateSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const today = todayDateInputValue();
  const editing = Boolean(entry);

  const [selectedType, setSelectedType] = useState<InteractionType>(
    entry?.type ?? "texted",
  );
  const [occurredOn, setOccurredOn] = useState(
    entry ? toDateInputValue(entry.at) : today,
  );
  const [note, setNote] = useState(entry?.body ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      setSelectedType(entry?.type ?? "texted");
      setOccurredOn(entry ? toDateInputValue(entry.at) : todayDateInputValue());
      setNote(entry?.body ?? "");
      setSaved(false);
      setConfirmingDelete(false);
      setError(null);
    };

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [entry]);

  async function readError(response: Response) {
    return response
      .json()
      .then((body) => body?.error as string | undefined)
      .catch(() => undefined);
  }

  function finish() {
    setSaving(false);
    setSaved(true);
    // Without this the change does not appear until a manual reload.
    router.refresh();
    window.setTimeout(() => dialogRef.current?.close(), 650);
  }

  async function save() {
    if (!note.trim() && editing) {
      setError("An update needs a few words before it can be saved.");
      return;
    }
    setSaving(true);
    setError(null);

    if (isPreviewOnly()) {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      finish();
      return;
    }

    const request = entry
      ? entry.kind === "update"
        ? {
            url: `/api/updates/${entry.id}`,
            body: {
              text: note,
              recordedAt: timestampFromDateInput(occurredOn),
              type: selectedType,
            },
          }
        : {
            url: `/api/interactions/${entry.id}`,
            body: {
              type: selectedType,
              occurredAt: timestampFromDateInput(occurredOn),
              note,
            },
          }
      : {
          url: "/api/interactions",
          body: {
            personId,
            type: selectedType,
            occurredAt: timestampFromDateInput(occurredOn),
            note,
          },
        };

    const response = await fetch(request.url, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
    });

    if (!response.ok) {
      setError((await readError(response)) || "That update could not be saved.");
      setSaving(false);
      return;
    }
    finish();
  }

  async function remove() {
    if (!entry) return;
    setSaving(true);
    setError(null);

    if (isPreviewOnly()) {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      finish();
      return;
    }

    const url =
      entry.kind === "update"
        ? `/api/updates/${entry.id}`
        : `/api/interactions/${entry.id}`;
    const response = await fetch(url, { method: "DELETE" });

    if (!response.ok) {
      setError(
        (await readError(response)) || "That update could not be deleted.",
      );
      setSaving(false);
      return;
    }
    finish();
  }

  const triggerClassName = {
    primary:
      "rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-card hover:bg-[#28332e]",
    compact:
      "relative z-10 size-10 shrink-0 rounded-full bg-sage text-sage-strong hover:bg-[#d3e1d7]",
    edit: "size-8 shrink-0 rounded-full text-ink-muted hover:bg-mist hover:text-ink",
  }[variant];

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={clsx(
          "inline-flex items-center justify-center gap-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2",
          triggerClassName,
        )}
        aria-label={
          variant === "edit"
            ? `Edit this update about ${personName}`
            : variant === "compact"
              ? `Add an update about ${personName}`
              : undefined
        }
      >
        {variant === "edit" ? (
          <PencilSimple size={15} aria-hidden="true" />
        ) : (
          <Plus size={variant === "compact" ? 18 : 17} weight="bold" aria-hidden="true" />
        )}
        {variant === "primary" ? buttonLabel : null}
      </button>

      <dialog
        ref={dialogRef}
        className="m-0 mt-auto max-h-[88vh] w-full max-w-none overflow-visible rounded-t-[2rem] bg-white p-0 text-ink shadow-float backdrop:bg-ink/40 sm:m-auto sm:w-[440px] sm:rounded-[2rem]"
        aria-labelledby={`update-sheet-${entry?.id ?? personId}`}
      >
        <div className="max-h-[88vh] overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 sm:p-6">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/12 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-coral-strong">
                {editing ? "Edit update" : "Quick log"}
              </p>
              <h2
                id={`update-sheet-${entry?.id ?? personId}`}
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

          <label
            className="mt-5 block text-xs font-semibold text-ink-muted"
            htmlFor={`occurred-on-${entry?.id ?? personId}`}
          >
            When did this happen?
            <input
              id={`occurred-on-${entry?.id ?? personId}`}
              type="date"
              value={occurredOn}
              max={today}
              onChange={(event) => setOccurredOn(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20"
            />
          </label>

          <label
            className="mt-5 block text-sm font-semibold"
            htmlFor={`note-${entry?.id ?? personId}`}
          >
            Add a note{" "}
            {editing ? null : (
              <span className="font-normal text-ink-muted">(optional)</span>
            )}
          </label>
          <textarea
            id={`note-${entry?.id ?? personId}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What do you want to remember?"
            className="mt-2 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20"
          />

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-2xl bg-[#fbe5e0] px-4 py-3 text-xs font-semibold leading-5 text-coral-strong"
            >
              {error}
            </p>
          ) : null}

          <button
            type="button"
            onClick={save}
            disabled={saving || saved}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 py-4 text-sm font-semibold text-white shadow-float transition-colors hover:bg-coral-strong disabled:cursor-wait disabled:bg-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            {saved ? (
              <>
                <Check size={18} weight="bold" aria-hidden="true" />
                Saved
              </>
            ) : saving ? (
              "Saving…"
            ) : editing ? (
              "Save changes"
            ) : (
              "Save update"
            )}
          </button>

          {editing ? (
            confirmingDelete ? (
              <div className="mt-4 rounded-2xl bg-porcelain p-4">
                <p className="text-xs font-semibold leading-5">
                  Delete this update? It will not be recoverable, and your
                  reminders for {personName} will move back accordingly.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={remove}
                    disabled={saving || saved}
                    className="flex-1 rounded-xl bg-coral px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-coral-strong disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
                  >
                    Yes, delete it
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="flex-1 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
                  >
                    Keep it
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-xs font-semibold text-ink-muted transition-colors hover:bg-mist hover:text-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <Trash size={15} aria-hidden="true" />
                Delete this update
              </button>
            )
          ) : null}
        </div>
      </dialog>
    </>
  );
}
