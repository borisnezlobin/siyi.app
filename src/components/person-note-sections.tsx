"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Plus,
  SpinnerGap,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getApiResponseError } from "@/lib/http";
import {
  maxNoteBodyLength,
  maxNoteHeadingLength,
  maxNoteSectionsPerPerson,
  moveNoteSection,
  normalizeNoteHeading,
  orderedNoteSections,
  suggestedNoteHeadings,
} from "@/lib/note-sections";
import type { PersonNote } from "@/lib/types";

const inputClassName =
  "h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";
const textareaClassName =
  "mt-2 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";
const iconButtonClassName =
  "grid size-9 shrink-0 place-items-center rounded-full bg-porcelain text-ink-muted transition-colors hover:bg-mist disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral";

type Draft = { heading: string; body: string };

export function PersonNoteSections({
  personId,
  available,
  initialSections,
  headingsUsedElsewhere,
  onSectionCountChange,
}: {
  personId: string;
  available: boolean;
  initialSections: PersonNote[];
  headingsUsedElsewhere: string[];
  onSectionCountChange?: (count: number) => void;
}) {
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [sections, setSections] = useState(() =>
    orderedNoteSections(initialSections),
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      initialSections.map((section) => [
        section.id,
        { heading: section.heading, body: section.body },
      ]),
    ),
  );
  const [newHeading, setNewHeading] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PersonNote | null>(null);
  const [error, setError] = useState("");

  const suggestions = useMemo(
    () =>
      suggestedNoteHeadings({
        previouslyUsed: headingsUsedElsewhere,
        alreadyOnThisPerson: sections.map((section) => section.heading),
      }),
    [headingsUsedElsewhere, sections],
  );

  useEffect(() => {
    onSectionCountChange?.(sections.length);
  }, [onSectionCountChange, sections.length]);

  if (!available) return null;

  function draftFor(section: PersonNote): Draft {
    return drafts[section.id] ?? { heading: section.heading, body: section.body };
  }

  function isDirty(section: PersonNote) {
    const draft = draftFor(section);
    return (
      normalizeNoteHeading(draft.heading) !== section.heading ||
      draft.body !== section.body
    );
  }

  function updateDraft(sectionId: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [sectionId]: { ...current[sectionId], ...patch },
    }));
  }

  async function addSection(heading: string) {
    const trimmed = normalizeNoteHeading(heading);
    if (!trimmed) {
      setError("Give the section a heading first.");
      return;
    }

    setError("");
    setBusyId("new");
    const response = await fetch("/api/person-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId, heading: trimmed, body: "" }),
    });

    if (!response.ok) {
      setError(await getApiResponseError(response, "That section was not added."));
      setBusyId(null);
      return;
    }

    const { note } = (await response.json()) as { note: NoteRow };
    const created = fromRow(note);
    setSections((current) => orderedNoteSections([...current, created]));
    setDrafts((current) => ({
      ...current,
      [created.id]: { heading: created.heading, body: created.body },
    }));
    setNewHeading("");
    setBusyId(null);
  }

  async function saveSection(section: PersonNote) {
    const draft = draftFor(section);
    const heading = normalizeNoteHeading(draft.heading);
    if (!heading) {
      setError("A section needs a heading.");
      return;
    }

    setError("");
    setBusyId(section.id);
    const response = await fetch(`/api/person-notes/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ heading, body: draft.body }),
    });

    if (!response.ok) {
      setError(await getApiResponseError(response, "That section was not saved."));
      setBusyId(null);
      return;
    }

    setSections((current) =>
      current.map((existing) =>
        existing.id === section.id
          ? { ...existing, heading, body: draft.body }
          : existing,
      ),
    );
    updateDraft(section.id, { heading });
    setBusyId(null);
  }

  async function move(section: PersonNote, direction: "up" | "down") {
    const reordered = moveNoteSection(sections, section.id, direction);
    setSections(reordered);
    setError("");

    const response = await fetch("/api/person-notes/order", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personId,
        noteIds: reordered.map((entry) => entry.id),
      }),
    });

    if (!response.ok) {
      setSections(sections);
      setError(await getApiResponseError(response, "The new order was not saved."));
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const section = pendingDelete;
    setBusyId(section.id);

    const response = await fetch(`/api/person-notes/${section.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setError(
        await getApiResponseError(response, "That section was not deleted."),
      );
      setBusyId(null);
      return;
    }

    setSections((current) =>
      current.filter((existing) => existing.id !== section.id),
    );
    setBusyId(null);
    setPendingDelete(null);
    deleteDialogRef.current?.close();
  }

  function requestDelete(section: PersonNote) {
    setPendingDelete(section);
    deleteDialogRef.current?.showModal();
  }

  const atSectionLimit = sections.length >= maxNoteSectionsPerPerson;

  return (
    <div className="mt-5 space-y-3">
      {sections.map((section, index) => {
        const draft = draftFor(section);
        const dirty = isDirty(section);
        const busy = busyId === section.id;

        return (
          <div key={section.id} className="rounded-2xl bg-porcelain p-3.5">
            <div className="flex items-center gap-2">
              <input
                value={draft.heading}
                maxLength={maxNoteHeadingLength}
                aria-label="Section heading"
                onChange={(event) =>
                  updateDraft(section.id, { heading: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                className={inputClassName}
              />
              <button
                type="button"
                onClick={() => void move(section, "up")}
                disabled={index === 0}
                className={iconButtonClassName}
                aria-label={`Move ${section.heading} up`}
              >
                <ArrowUp size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => void move(section, "down")}
                disabled={index === sections.length - 1}
                className={iconButtonClassName}
                aria-label={`Move ${section.heading} down`}
              >
                <ArrowDown size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => requestDelete(section)}
                className={iconButtonClassName}
                aria-label={`Delete ${section.heading}`}
              >
                <Trash size={15} aria-hidden="true" />
              </button>
            </div>
            <textarea
              value={draft.body}
              rows={4}
              maxLength={maxNoteBodyLength}
              aria-label={`${section.heading} notes`}
              placeholder="What belongs under this heading?"
              onChange={(event) =>
                updateDraft(section.id, { body: event.target.value })
              }
              className={textareaClassName}
            />
            {dirty ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold text-coral-strong">
                  Not saved yet
                </p>
                <button
                  type="button"
                  onClick={() => void saveSection(section)}
                  disabled={busy}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-xs font-semibold text-white transition-colors hover:bg-ink/85 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
                >
                  {busy ? (
                    <SpinnerGap size={14} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Check size={14} weight="bold" aria-hidden="true" />
                  )}
                  Save section
                </button>
              </div>
            ) : null}
          </div>
        );
      })}

      {atSectionLimit ? (
        <p className="text-xs text-ink-muted">
          That is as many sections as one person can hold.
        </p>
      ) : (
        <div className="rounded-2xl bg-porcelain p-3.5">
          <div className="flex items-center gap-2">
            <input
              value={newHeading}
              maxLength={maxNoteHeadingLength}
              placeholder="New heading, like Interests"
              aria-label="New section heading"
              onChange={(event) => setNewHeading(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                void addSection(newHeading);
              }}
              className={inputClassName}
            />
            <button
              type="button"
              onClick={() => void addSection(newHeading)}
              disabled={busyId === "new"}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-coral px-4 text-xs font-semibold text-white transition-colors hover:bg-coral-strong disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
            >
              {busyId === "new" ? (
                <SpinnerGap size={14} className="animate-spin" aria-hidden="true" />
              ) : (
                <Plus size={14} weight="bold" aria-hidden="true" />
              )}
              Add
            </button>
          </div>
          {suggestions.length ? (
            <div className="mt-3">
              <p className="text-[11px] font-semibold text-ink-muted">
                Headings you use on other people
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((heading) => (
                  <button
                    key={heading}
                    type="button"
                    onClick={() => void addSection(heading)}
                    className="rounded-full bg-mist px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-sage hover:text-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                  >
                    {heading}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fbe5e0] px-4 py-3 text-xs text-coral-strong">
          {error}
        </p>
      ) : null}

      <dialog
        ref={deleteDialogRef}
        className="m-auto w-[min(400px,calc(100vw-2rem))] rounded-[1.5rem] bg-white p-6 text-ink shadow-float backdrop:bg-ink/40"
        aria-labelledby={`delete-section-${personId}`}
      >
        <h2
          id={`delete-section-${personId}`}
          className="font-display text-2xl leading-none"
        >
          Delete this section?
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          {pendingDelete
            ? `“${pendingDelete.heading}” and everything written under it will be gone for good.`
            : ""}
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setPendingDelete(null);
              deleteDialogRef.current?.close();
            }}
            className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-porcelain text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            <X size={15} aria-hidden="true" />
            Keep it
          </button>
          <button
            type="button"
            onClick={() => void confirmDelete()}
            className="flex h-12 items-center justify-center gap-1.5 rounded-2xl bg-coral text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            <Trash size={15} aria-hidden="true" />
            Delete
          </button>
        </div>
      </dialog>
    </div>
  );
}

type NoteRow = {
  id: string;
  person_id: string;
  user_id: string;
  heading: string;
  body: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

function fromRow(row: NoteRow): PersonNote {
  return {
    id: row.id,
    personId: row.person_id,
    userId: row.user_id,
    heading: row.heading,
    body: row.body ?? "",
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
