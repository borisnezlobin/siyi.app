"use client";

import { Check, PencilSimple, Trash, X } from "@phosphor-icons/react";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CustomTypeIconPicker,
  useRecentCustomLabels,
} from "@/components/custom-type-fields";
import { DateField } from "@/components/date-field";
import { isPreviewOnly } from "@/lib/capture-client";
import {
  isCustomTypeIconKey,
  type CustomTypeIconKey,
} from "@/lib/custom-type-icons";
import {
  timestampFromDateInput,
  toDateInputValue,
  todayDateInputValue,
} from "@/lib/date-input";
import { getApiResponseError } from "@/lib/http";
import { interactionLabels } from "@/lib/interaction-labels";
import {
  interactionFromTitle,
  interactionTitleSuggestions,
} from "@/lib/interaction-title";
import type { InteractionType } from "@/lib/types";

export type EditableEntry = {
  kind: "update" | "interaction";
  id: string;
  type: InteractionType;
  body: string;
  at: string;
  /**
   * False for an update that only records something you learned. Rows written
   * before the two were told apart say true, and keep saying true.
   */
  countsAsContact: boolean;
  customLabel?: string | null;
  customIcon?: string | null;
};

function titleOf(entry: EditableEntry) {
  return entry.customLabel?.trim() || interactionLabels[entry.type] || "";
}

/**
 * Corrects an entry that is already on the timeline. Whether it counted as
 * contact was decided when it was saved and is never quietly changed here — an
 * old entry keeps driving reminders exactly as it did before.
 */
export function UpdateSheet({
  personName,
  entry,
}: {
  personName: string;
  entry: EditableEntry;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const today = todayDateInputValue();

  const [title, setTitle] = useState(titleOf(entry));
  const [occurredOn, setOccurredOn] = useState(toDateInputValue(entry.at));
  const [body, setBody] = useState(entry.body);
  const [customIcon, setCustomIcon] = useState<CustomTypeIconKey | "">(
    isCustomTypeIconKey(entry.customIcon) ? entry.customIcon : "",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolved = interactionFromTitle(title);
  const recentLabels = useRecentCustomLabels(entry.countsAsContact);
  const titleChoices = Array.from(
    new Set([...interactionTitleSuggestions, ...recentLabels]),
  ).slice(0, 10);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      setTitle(titleOf(entry));
      setOccurredOn(toDateInputValue(entry.at));
      setBody(entry.body);
      setCustomIcon(
        isCustomTypeIconKey(entry.customIcon) ? entry.customIcon : "",
      );
      setSaved(false);
      setConfirmingDelete(false);
      setError(null);
    };

    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [entry]);

  function finish() {
    setSaving(false);
    setSaved(true);
    // Without this the change does not appear until a manual reload.
    router.refresh();
    window.setTimeout(() => dialogRef.current?.close(), 650);
  }

  async function save() {
    if (!body.trim()) {
      setError("An entry needs a few words before it can be saved.");
      return;
    }
    setSaving(true);
    setError(null);

    if (isPreviewOnly()) {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      finish();
      return;
    }

    const naming = {
      customLabel: resolved.customLabel,
      customIcon: resolved.type === "other" ? customIcon || null : null,
    };
    const request =
      entry.kind === "update"
        ? {
            url: `/api/updates/${entry.id}`,
            body: {
              text: body,
              recordedAt: timestampFromDateInput(occurredOn),
              type: resolved.type,
              ...naming,
            },
          }
        : {
            url: `/api/interactions/${entry.id}`,
            body: {
              type: resolved.type,
              occurredAt: timestampFromDateInput(occurredOn),
              note: body,
              ...naming,
            },
          };

    const response = await fetch(request.url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.body),
    });

    if (!response.ok) {
      setError(await getApiResponseError(response, "That could not be saved."));
      setSaving(false);
      return;
    }
    finish();
  }

  async function remove() {
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
        await getApiResponseError(response, "That could not be deleted."),
      );
      setSaving(false);
      return;
    }
    finish();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        aria-label={`Edit this entry about ${personName}`}
      >
        <PencilSimple size={15} aria-hidden="true" />
      </button>

      <dialog
        ref={dialogRef}
        className="m-0 mt-auto max-h-[88dvh] w-full max-w-none overflow-visible rounded-t-[2rem] bg-white p-0 text-ink shadow-float backdrop:bg-ink/40 sm:m-auto sm:w-[440px] sm:rounded-[2rem]"
        aria-labelledby={`update-sheet-${entry.id}`}
      >
        {/* Save is pinned below the scrolling body. Opening the delete
            confirmation used to grow the form underneath it. */}
        <div className="flex max-h-[88dvh] flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 sm:px-6 sm:pt-6">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/12 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-coral-strong">
                {entry.countsAsContact ? "Edit interaction" : "Edit update"}
              </p>
              <h2
                id={`update-sheet-${entry.id}`}
                className="mt-1 font-display text-3xl leading-none"
              >
                {personName}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-mist text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              aria-label="Close edit sheet"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {entry.countsAsContact ? (
            <>
              <label
                className="mt-6 block text-xs font-semibold text-ink-muted"
                htmlFor={`title-${entry.id}`}
              >
                What was it?
              </label>
              <input
                id={`title-${entry.id}`}
                type="text"
                value={title}
                maxLength={40}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Coffee, studio night, ran into them…"
                className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {titleChoices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    onClick={() => setTitle(choice)}
                    className={clsx(
                      "rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                      title === choice
                        ? "bg-ink text-white"
                        : "bg-porcelain text-ink-muted hover:text-ink",
                    )}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              {resolved.type === "other" ? (
                <CustomTypeIconPicker
                  icon={customIcon}
                  onIconChange={setCustomIcon}
                />
              ) : null}
            </>
          ) : null}

          <DateField
            className="mt-5"
            inputClassName="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20"
            label={
              entry.countsAsContact ? "When did this happen?" : "When did you learn this?"
            }
            max={today}
            onChange={setOccurredOn}
            value={occurredOn}
          />

          <label
            className="mt-5 block text-xs font-semibold text-ink-muted"
            htmlFor={`note-${entry.id}`}
          >
            {entry.countsAsContact ? "Add a note" : "What you learned"}
          </label>
          <textarea
            id={`note-${entry.id}`}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="What do you want to remember?"
            className="mt-1.5 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
          />

          {confirmingDelete ? (
            <div className="mt-4 rounded-2xl bg-porcelain p-4">
              <p className="text-xs font-semibold leading-5">
                {entry.countsAsContact
                  ? `Delete this? It will not be recoverable, and your reminders for ${personName} will move back accordingly.`
                  : "Delete this update? It will not be recoverable."}
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
              Delete this entry
            </button>
          )}
        </div>

        <div className="shrink-0 border-t border-black/5 bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 sm:px-6">
          {error ? (
            <p
              role="alert"
              className="mb-3 rounded-2xl bg-[#fbe5e0] px-4 py-3 text-xs font-semibold leading-5 text-coral-strong"
            >
              {error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={save}
            disabled={saving || saved}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 py-4 text-sm font-semibold text-white shadow-float transition-colors hover:bg-coral-strong disabled:cursor-wait disabled:bg-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            {saved ? (
              <>
                <Check size={18} weight="bold" aria-hidden="true" />
                Saved
              </>
            ) : saving ? (
              "Saving…"
            ) : (
              "Save changes"
            )}
          </button>
        </div>
        </div>
      </dialog>
    </>
  );
}
