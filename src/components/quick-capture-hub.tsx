"use client";

import {
  CalendarBlank,
  CaretDown,
  ChatCircleDots,
  Check,
  CheckSquareOffset,
  SpinnerGap,
  UserPlus,
  X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { addDays, format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  timestampFromDateInput,
  todayDateInputValue,
} from "@/lib/date-input";
import { getApiResponseError } from "@/lib/http";
import { interactionOptions } from "@/lib/interaction-options";
import type { InteractionType, Person } from "@/lib/types";

type QuickPerson = Pick<
  Person,
  "id" | "fullName" | "preferredName" | "profilePhotoUrl"
>;
type CaptureMode = "follow-up" | "interaction";

const quickCaptureEvent = "siyi:quick-capture";

type QuickCaptureEventDetail = {
  mode: CaptureMode;
  personId?: string;
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
  surface?: "default" | "sidebar";
}) {
  const Icon = mode === "follow-up" ? CheckSquareOffset : ChatCircleDots;

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
          ? "grid size-9 shrink-0 place-items-center rounded-full bg-sage text-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          : clsx(
              "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2",
              surface === "sidebar"
                ? "bg-white/10 text-white hover:bg-white/16 focus-visible:ring-sun"
                : "bg-ink text-white shadow-card focus-visible:ring-coral",
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
  people,
  menuOpen,
  onMenuOpenChange,
}: {
  people: QuickPerson[];
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<CaptureMode | null>(null);
  const [personId, setPersonId] = useState("");
  const [followUpText, setFollowUpText] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [interactionType, setInteractionType] =
    useState<InteractionType>("texted");
  const [occurredOn, setOccurredOn] = useState(todayDateInputValue());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const openCapture = useCallback(
    (nextMode: CaptureMode, nextPersonId?: string) => {
      onMenuOpenChange(false);
      setPersonId(nextPersonId ?? "");
      setDueDate(format(addDays(new Date(), 1), "yyyy-MM-dd"));
      setOccurredOn(todayDateInputValue());
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

  function resetSheet() {
    setMode(null);
    setPersonId("");
    setFollowUpText("");
    setInteractionType("texted");
    setOccurredOn(todayDateInputValue());
    setNote("");
    setSaving(false);
    setSaved(false);
    setError("");
  }

  function closeSheet() {
    dialogRef.current?.close();
  }

  async function saveFollowUp() {
    if (!personId) {
      setError("Choose who this is for.");
      return;
    }
    if (!followUpText.trim()) {
      setError("Add what you want to remember.");
      return;
    }
    if (!dueDate) {
      setError("Choose a due date.");
      return;
    }

    setSaving(true);
    setError("");

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId,
          text: followUpText,
          dueAt: new Date(`${dueDate}T12:00:00`).toISOString(),
        }),
      });

      if (!response.ok) {
        setError(
          await getApiResponseError(
            response,
            "The follow-up could not be saved.",
          ),
        );
        setSaving(false);
        return;
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    }

    setSaving(false);
    setSaved(true);
    router.refresh();
    window.setTimeout(closeSheet, 550);
  }

  async function saveInteraction() {
    if (!personId) {
      setError("Choose who you spent time with.");
      return;
    }

    setSaving(true);
    setError("");

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personId,
          type: interactionType,
          occurredAt: timestampFromDateInput(occurredOn),
          note,
        }),
      });

      if (!response.ok) {
        setError(
          await getApiResponseError(
            response,
            "That update could not be saved.",
          ),
        );
        setSaving(false);
        return;
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    }

    setSaving(false);
    setSaved(true);
    router.refresh();
    window.setTimeout(closeSheet, 550);
  }

  const selectedPerson = people.find((person) => person.id === personId);

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
          "fixed bottom-[calc(5.4rem+env(safe-area-inset-bottom))] left-1/2 z-50 grid w-[min(360px,calc(100vw-2rem))] -translate-x-1/2 grid-cols-3 gap-2 rounded-[1.4rem] bg-ink p-2 shadow-float transition-all duration-200 ease-out lg:hidden",
          menuOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-3 scale-95 opacity-0",
        )}
        aria-hidden={!menuOpen}
      >
        <Link
          href="/people/new"
          onClick={() => onMenuOpenChange(false)}
          className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-white px-2 text-[11px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
        >
          <UserPlus size={23} weight="fill" className="text-coral" aria-hidden="true" />
          Person
        </Link>
        <button
          type="button"
          onClick={() => {
            onMenuOpenChange(false);
            window.setTimeout(() => openCapture("follow-up"), 130);
          }}
          className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-sage px-2 text-[11px] font-semibold text-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
        >
          <CheckSquareOffset size={23} weight="fill" aria-hidden="true" />
          Follow-up
        </button>
        <button
          type="button"
          onClick={() => {
            onMenuOpenChange(false);
            window.setTimeout(() => openCapture("interaction"), 130);
          }}
          className="flex min-h-20 flex-col items-center justify-center gap-2 rounded-2xl bg-[#fff5d8] px-2 text-[11px] font-semibold text-[#705513] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
        >
          <ChatCircleDots size={23} weight="fill" aria-hidden="true" />
          Update
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
                {mode === "follow-up" ? "Keep a promise" : "Add a moment"}
              </p>
              <h2
                id="quick-capture-title"
                className="mt-1 font-display text-3xl leading-none"
              >
                {mode === "follow-up"
                  ? "What needs following up?"
                  : "Who did you spend time with?"}
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

          {people.length ? (
            <>
              <label className="mt-6 block text-xs font-semibold text-ink-muted">
                Person
                <span className="relative mt-1.5 block">
                  <select
                    value={personId}
                    onChange={(event) => setPersonId(event.target.value)}
                    className="h-12 w-full appearance-none rounded-2xl border border-black/10 bg-white px-4 pr-10 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
                  >
                    <option value="">Choose someone</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.preferredName ?? person.fullName}
                      </option>
                    ))}
                  </select>
                  <CaretDown
                    size={14}
                    className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                </span>
              </label>

              {mode === "follow-up" ? (
                <>
                  <label className="mt-4 block text-xs font-semibold text-ink-muted">
                    Follow-up
                    <input
                      value={followUpText}
                      onChange={(event) => setFollowUpText(event.target.value)}
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
                                ? "bg-sage text-sage-strong"
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
              ) : (
                <>
                  <fieldset className="mt-5">
                    <legend className="text-xs font-semibold text-ink-muted">
                      What did you do?
                    </legend>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {interactionOptions.map(
                        ({ value, label, icon: Icon }) => {
                          const active = interactionType === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setInteractionType(value)}
                              className={clsx(
                                "flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                                active
                                  ? "bg-sage text-sage-strong"
                                  : "bg-porcelain text-ink-muted",
                              )}
                              aria-pressed={active}
                            >
                              <Icon
                                size={19}
                                weight={active ? "fill" : "regular"}
                                aria-hidden="true"
                              />
                              {label}
                            </button>
                          );
                        },
                      )}
                    </div>
                  </fieldset>
                  <label className="mt-4 block text-xs font-semibold text-ink-muted">
                    When did this happen?
                    <span className="relative mt-1.5 block">
                      <CalendarBlank
                        size={17}
                        className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-ink-muted"
                        aria-hidden="true"
                      />
                      <input
                        type="date"
                        value={occurredOn}
                        max={todayDateInputValue()}
                        onChange={(event) => setOccurredOn(event.target.value)}
                        className="h-12 w-full rounded-2xl border border-black/10 bg-white pl-11 pr-4 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
                      />
                    </span>
                  </label>
                  <label className="mt-4 block text-xs font-semibold text-ink-muted">
                    Note <span className="font-normal">(optional)</span>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder="Anything worth remembering?"
                      className="mt-1.5 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
                    />
                  </label>
                </>
              )}

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
                  mode === "follow-up" ? saveFollowUp : saveInteraction
                }
                disabled={saving || saved}
                className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 py-3.5 text-sm font-semibold text-white shadow-float disabled:cursor-wait disabled:bg-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
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
                ) : mode === "follow-up" ? (
                  "Save follow-up"
                ) : (
                  "Save update"
                )}
              </button>
            </>
          ) : (
            <div className="mt-6 rounded-2xl bg-porcelain p-5 text-center">
              <p className="text-sm font-semibold">Add someone first.</p>
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                Follow-ups and updates need a person to belong to.
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

          {selectedPerson ? (
            <p className="sr-only">
              Selected {selectedPerson.preferredName ?? selectedPerson.fullName}
            </p>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
