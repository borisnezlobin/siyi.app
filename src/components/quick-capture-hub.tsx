"use client";

import {
  CalendarBlank,
  Check,
  ClockCountdown,
  NotePencil,
  SpinnerGap,
  UserPlus,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { addDays, format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  emptyInteractionDraft,
  InteractionComposer,
  type InteractionDraft,
} from "@/components/interaction-composer";
import { PersonPicker } from "@/components/person-picker";
import { isPreviewOnly, logInteraction, saveUpdate } from "@/lib/capture-client";
import { todayDateInputValue } from "@/lib/date-input";
import { getApiResponseError } from "@/lib/http";
import type { Person } from "@/lib/types";

type QuickPerson = Pick<
  Person,
  "id" | "fullName" | "preferredName" | "profilePhotoUrl" | "lastInteractionAt"
>;

/**
 * Three separate things, and the difference between the last two is the whole
 * point: an interaction says you saw someone, an update says you learned
 * something about them.
 */
type CaptureMode = "reminder" | "interaction" | "update";

const quickCaptureEvent = "siyi:quick-capture";

type QuickCaptureEventDetail = {
  mode: CaptureMode;
  personId?: string;
};

const modeCopy: Record<
  CaptureMode,
  { eyebrow: string; title: string; save: string }
> = {
  "reminder": {
    eyebrow: "Keep a promise",
    title: "What needs following up?",
    save: "Save reminder",
  },
  interaction: {
    eyebrow: "Log time together",
    title: "Who did you see?",
    save: "Log interaction",
  },
  update: {
    eyebrow: "Something you learned",
    title: "What did you find out?",
    save: "Save update",
  },
};

export function QuickCaptureTrigger({
  mode,
  personId,
  label,
  compact = false,
  surface = "default",
}: QuickCaptureEventDetail & {
  label: string;
  compact?: boolean;
  surface?: "default" | "sidebar" | "quiet";
}) {
  const Icon =
    mode === "reminder"
      ? ClockCountdown
      : mode === "interaction"
        ? UsersThree
        : NotePencil;

  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent<QuickCaptureEventDetail>(quickCaptureEvent, {
            detail: { mode, personId },
          }),
        )
      }
      className={
        compact
          ? "grid size-9 shrink-0 place-items-center rounded-full bg-mist text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          : clsx(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2",
              surface === "sidebar"
                ? "w-full bg-white/10 text-white hover:bg-white/16 focus-visible:ring-sun"
                : surface === "quiet"
                  ? "text-ink-muted hover:text-ink focus-visible:ring-coral"
                  : "w-full bg-ink text-white shadow-card focus-visible:ring-coral",
            )
      }
      aria-label={compact ? label : undefined}
    >
      <Icon size={compact ? 17 : 16} weight="fill" aria-hidden="true" />
      {compact ? null : label}
    </button>
  );
}

export function QuickCaptureHub({
  menuOpen,
  onMenuOpenChange,
}: {
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
}) {
  const [people, setPeople] = useState<QuickPerson[]>([]);
  const [peopleLoaded, setPeopleLoaded] = useState(false);
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<CaptureMode | null>(null);
  const [personId, setPersonId] = useState("");
  const [reminderText, setReminderText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [interactionDraft, setInteractionDraft] = useState<InteractionDraft>(
    emptyInteractionDraft(),
  );
  const [updateText, setUpdateText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const openCapture = useCallback(
    (nextMode: CaptureMode, nextPersonId?: string) => {
      onMenuOpenChange(false);
      setPersonId(nextPersonId ?? "");
      setDueDate(format(addDays(new Date(), 1), "yyyy-MM-dd"));
      setInteractionDraft(
        emptyInteractionDraft(nextPersonId ? [nextPersonId] : []),
      );
      setMode(nextMode);
      setError("");
      setSaved(false);
    },
    [onMenuOpenChange],
  );

  useEffect(() => {
    const openFromElsewhere = (event: Event) => {
      const customEvent = event as CustomEvent<QuickCaptureEventDetail>;
      openCapture(customEvent.detail.mode, customEvent.detail.personId);
    };

    window.addEventListener(quickCaptureEvent, openFromElsewhere);
    return () =>
      window.removeEventListener(quickCaptureEvent, openFromElsewhere);
  }, [openCapture]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (mode && dialog && !dialog.open) dialog.showModal();
  }, [mode]);

  // Fetched the first time the sheet opens rather than with every page load,
  // because most visits never capture anything.
  useEffect(() => {
    if (!mode || peopleLoaded) return;
    let cancelled = false;
    fetch("/api/quick-people")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled || !Array.isArray(body?.people)) return;
        setPeople(body.people);
        setPeopleLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode, peopleLoaded]);

  function resetSheet() {
    setMode(null);
    setPersonId("");
    setReminderText("");
    setInteractionDraft(emptyInteractionDraft());
    setUpdateText("");
    setSaving(false);
    setSaved(false);
    setError("");
  }

  function closeSheet() {
    dialogRef.current?.close();
  }

  function finish() {
    setSaving(false);
    setSaved(true);
    router.refresh();
    window.setTimeout(closeSheet, 550);
  }

  async function saveReminder() {
    if (!personId) {
      setError("Choose who this is for.");
      return;
    }
    if (!reminderText.trim()) {
      setError("Add what you want to remember.");
      return;
    }
    if (!dueDate) {
      setError("Choose a due date.");
      return;
    }

    setSaving(true);
    setError("");

    if (isPreviewOnly()) {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      finish();
      return;
    }

    const response = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId,
        text: reminderText,
        dueAt: new Date(`${dueDate}T12:00:00`).toISOString(),
      }),
    });

    if (!response.ok) {
      setError(
        await getApiResponseError(response, "The reminder could not be saved."),
      );
      setSaving(false);
      return;
    }
    finish();
  }

  async function saveInteraction() {
    if (!interactionDraft.personIds.length) {
      setError("Choose who you saw.");
      return;
    }

    setSaving(true);
    setError("");
    const failure = await logInteraction(interactionDraft);
    if (failure) {
      setError(failure);
      setSaving(false);
      return;
    }
    finish();
  }

  async function savePersonUpdate() {
    if (!personId) {
      setError("Choose who this is about.");
      return;
    }
    if (!updateText.trim()) {
      setError("Write what you learned.");
      return;
    }

    setSaving(true);
    setError("");
    const failure = await saveUpdate({
      personId,
      text: updateText,
      recordedOn: todayDateInputValue(),
    });
    if (failure) {
      setError(failure);
      setSaving(false);
      return;
    }
    finish();
  }

  const copy = modeCopy[mode ?? "interaction"];

  return (
    <>
      {menuOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-ink/10 lg:hidden"
          onClick={() => onMenuOpenChange(false)}
          aria-label="Close quick actions"
        />
      ) : null}

      <div
        className={clsx(
          "fixed bottom-[calc(5.4rem+env(safe-area-inset-bottom))] left-1/2 z-50 w-[min(360px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-[1.4rem] bg-white shadow-float transition-all duration-200 ease-out lg:hidden",
          menuOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-3 scale-95 opacity-0",
        )}
        aria-hidden={!menuOpen}
      >
        {/* Adding a person is the one action here that creates something rather
            than recording something, so it leads and carries the accent. */}
        <Link
          href="/people/new"
          onClick={() => onMenuOpenChange(false)}
          className="m-2 flex items-center gap-3 rounded-2xl bg-coral px-4 py-4 text-left text-white transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          <UserPlus size={20} weight="fill" className="shrink-0" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Add a person</span>
            <span className="block text-[11px] text-white/75">
              Someone new to remember
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => {
            onMenuOpenChange(false);
            window.setTimeout(() => openCapture("interaction"), 130);
          }}
          className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-porcelain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          <UsersThree size={19} className="shrink-0 text-ink" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Log an interaction</span>
            <span className="block text-[11px] text-ink-muted">
              Who you saw or spoke to
            </span>
          </span>
        </button>
        <span className="mx-4 block h-px bg-ink/[0.07]" aria-hidden="true" />
        <button
          type="button"
          onClick={() => {
            onMenuOpenChange(false);
            window.setTimeout(() => openCapture("update"), 130);
          }}
          className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-porcelain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          <NotePencil size={19} className="shrink-0 text-ink" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Add an update</span>
            <span className="block text-[11px] text-ink-muted">
              Something you learned about them
            </span>
          </span>
        </button>
        <span className="mx-4 block h-px bg-ink/[0.07]" aria-hidden="true" />
        <button
          type="button"
          onClick={() => {
            onMenuOpenChange(false);
            window.setTimeout(() => openCapture("reminder"), 130);
          }}
          className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-porcelain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          <ClockCountdown
            size={19}
            className="shrink-0 text-ink"
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Add a reminder</span>
            <span className="block text-[11px] text-ink-muted">
              Something to do before you forget
            </span>
          </span>
        </button>
      </div>

      <dialog
        ref={dialogRef}
        onClose={resetSheet}
        className="quick-capture-sheet m-0 mt-auto max-h-[90vh] w-full max-w-none overflow-visible rounded-t-[2rem] bg-white p-0 text-ink shadow-float backdrop:bg-ink/40 sm:m-auto sm:w-[460px] sm:rounded-[2rem]"
        aria-labelledby="quick-capture-title"
      >
        <div className="max-h-[90vh] overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 sm:p-6">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/12 sm:hidden" />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-coral-strong">
                {copy.eyebrow}
              </p>
              <h2
                id="quick-capture-title"
                className="mt-1 font-display text-3xl leading-none"
              >
                {copy.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeSheet}
              className="grid size-10 shrink-0 place-items-center rounded-full bg-mist text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              aria-label="Close quick capture"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {!peopleLoaded || people.length ? (
            <>
              {mode === "interaction" ? (
                <div className="mt-6">
                  <InteractionComposer
                    people={people}
                    draft={interactionDraft}
                    onDraftChange={setInteractionDraft}
                    facesShown={8}
                  />
                </div>
              ) : (
                <PersonPicker
                  people={people}
                  value={personId}
                  onChange={setPersonId}
                  label={mode === "update" ? "Who is this about?" : "Person"}
                />
              )}

              {mode === "reminder" ? (
                <>
                  <label className="mt-4 block text-xs font-semibold text-ink-muted">
                    Reminder
                    <input
                      value={reminderText}
                      onChange={(event) => setReminderText(event.target.value)}
                      maxLength={500}
                      placeholder="Send the class notes"
                      className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
                    />
                  </label>
                  <fieldset className="mt-4">
                    <legend className="text-xs font-semibold text-ink-muted">
                      When?
                    </legend>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {[
                        { label: "Today", days: 0 },
                        { label: "Tomorrow", days: 1 },
                        { label: "Next week", days: 7 },
                      ].map((option) => {
                        const value = format(
                          addDays(new Date(), option.days),
                          "yyyy-MM-dd",
                        );
                        return (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() => setDueDate(value)}
                            className={clsx(
                              "rounded-xl px-2 py-3 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                              dueDate === value
                                ? "bg-ink text-white"
                                : "bg-porcelain text-ink-muted",
                            )}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                  <label className="mt-3 block text-xs font-semibold text-ink-muted">
                    Or choose a date
                    <span className="relative mt-1.5 block">
                      <CalendarBlank
                        size={17}
                        className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-ink-muted"
                        aria-hidden="true"
                      />
                      <input
                        type="date"
                        value={dueDate}
                        min={format(new Date(), "yyyy-MM-dd")}
                        onChange={(event) => setDueDate(event.target.value)}
                        className="h-12 w-full rounded-2xl border border-black/10 bg-white pl-11 pr-4 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
                      />
                    </span>
                  </label>
                </>
              ) : null}

              {mode === "update" ? (
                <>
                  <label className="mt-5 block text-xs font-semibold text-ink-muted">
                    What did you learn?
                    <textarea
                      value={updateText}
                      onChange={(event) => setUpdateText(event.target.value)}
                      rows={3}
                      maxLength={2000}
                      placeholder="Is interested in photography"
                      className="mt-1.5 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
                    />
                  </label>
                  <p className="mt-2 text-[11px] leading-5 text-ink-muted">
                    This goes on their profile. It does not count as seeing
                    them, so their reminder stays where it is.
                  </p>
                </>
              ) : null}

              {error ? (
                <p
                  role="alert"
                  className="mt-4 rounded-xl bg-[#fbe5e0] px-3 py-2.5 text-xs font-semibold text-coral-strong"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={
                  mode === "reminder"
                    ? saveReminder
                    : mode === "update"
                      ? savePersonUpdate
                      : saveInteraction
                }
                disabled={saving || saved}
                className="mt-5 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 py-3.5 text-sm font-semibold text-white shadow-float disabled:cursor-wait disabled:bg-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
              >
                {saved ? (
                  <>
                    <Check size={18} weight="bold" aria-hidden="true" />
                    Saved
                  </>
                ) : saving ? (
                  <>
                    <SpinnerGap
                      size={18}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Saving…
                  </>
                ) : (
                  copy.save
                )}
              </button>
            </>
          ) : (
            <div className="mt-6 rounded-2xl bg-porcelain p-5 text-center">
              <p className="text-sm font-semibold">Add someone first.</p>
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                Interactions, updates and reminders all need a person to belong
                to.
              </p>
              <Link
                href="/people/new"
                onClick={closeSheet}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-coral px-4 py-3 text-xs font-semibold text-white"
              >
                <UserPlus size={17} weight="fill" aria-hidden="true" />
                Add someone
              </Link>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
