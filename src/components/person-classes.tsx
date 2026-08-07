"use client";

import { Plus, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  courseOptions,
  formatTimeRange,
  parseDays,
  weekdays,
  type PersonClass,
} from "@/lib/classes";
import { getApiResponseError } from "@/lib/http";

const inputClassName =
  "h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";

/**
 * The classes somebody is taking. Course codes already used elsewhere are
 * offered as you type, so the fifth person in a course is a couple of taps
 * rather than a form.
 */
export function PersonClasses({
  personId,
  classes,
  knownClasses,
}: {
  personId: string;
  classes: PersonClass[];
  knownClasses: PersonClass[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    courseCode: "",
    courseTitle: "",
    professor: "",
    days: "",
    startsAt: "",
    endsAt: "",
    location: "",
  });

  const options = courseOptions(knownClasses);

  async function add() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/person-classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId, ...draft }),
      });
      if (!response.ok) {
        throw new Error(
          await getApiResponseError(response, "That class could not be saved."),
        );
      }
      setDraft({
        courseCode: "",
        courseTitle: "",
        professor: "",
        days: "",
        startsAt: "",
        endsAt: "",
        location: "",
      });
      setAdding(false);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "That class could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await fetch("/api/person-classes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  return (
    <div>
      {classes.length > 0 ? (
        <ul className="space-y-2">
          {classes.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center gap-3 rounded-2xl bg-porcelain px-3.5 py-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">
                  {entry.courseCode}
                  {entry.courseTitle ? ` · ${entry.courseTitle}` : ""}
                </span>
                <span className="block truncate text-xs text-ink-muted">
                  {[
                    entry.professor,
                    parseDays(entry.days).join(""),
                    formatTimeRange(entry.startsAt, entry.endsAt),
                    entry.location,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No schedule saved"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void remove(entry.id)}
                aria-label={`Remove ${entry.courseCode}`}
                className="grid size-8 shrink-0 place-items-center rounded-full text-ink-muted hover:bg-mist hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <X size={14} weight="bold" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">No classes saved yet.</p>
      )}

      {adding ? (
        <div className="mt-3 rounded-2xl bg-porcelain p-3.5">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-ink-muted">
              Course
              <input
                list="known-courses"
                value={draft.courseCode}
                onChange={(event) =>
                  setDraft({ ...draft, courseCode: event.target.value })
                }
                placeholder="DATA 8"
                className={`mt-1 ${inputClassName}`}
              />
              <datalist id="known-courses">
                {options.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.title ?? ""}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="text-xs font-semibold text-ink-muted">
              Professor
              <input
                value={draft.professor}
                onChange={(event) =>
                  setDraft({ ...draft, professor: event.target.value })
                }
                placeholder="DeNero"
                className={`mt-1 ${inputClassName}`}
              />
            </label>
            <label className="text-xs font-semibold text-ink-muted">
              Title
              <input
                value={draft.courseTitle}
                onChange={(event) =>
                  setDraft({ ...draft, courseTitle: event.target.value })
                }
                placeholder="Foundations of Data Science"
                className={`mt-1 ${inputClassName}`}
              />
            </label>
            <label className="text-xs font-semibold text-ink-muted">
              Where
              <input
                value={draft.location}
                onChange={(event) =>
                  setDraft({ ...draft, location: event.target.value })
                }
                placeholder="Wheeler 150"
                className={`mt-1 ${inputClassName}`}
              />
            </label>
          </div>

          <fieldset className="mt-3">
            <legend className="text-xs font-semibold text-ink-muted">Days</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {weekdays.map((day) => {
                const on = parseDays(draft.days).includes(day.key);
                return (
                  <button
                    key={day.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const current = parseDays(draft.days);
                      const next = on
                        ? current.filter((key) => key !== day.key)
                        : [...current, day.key];
                      setDraft({
                        ...draft,
                        days: weekdays
                          .map(({ key }) => key)
                          .filter((key) => next.includes(key))
                          .join(""),
                      });
                    }}
                    className={`h-9 rounded-lg px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
                      on ? "bg-ink text-white" : "bg-white text-ink-muted hover:bg-mist"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-ink-muted">
              Starts
              <input
                type="time"
                value={draft.startsAt}
                onChange={(event) =>
                  setDraft({ ...draft, startsAt: event.target.value })
                }
                className={`mt-1 ${inputClassName}`}
              />
            </label>
            <label className="text-xs font-semibold text-ink-muted">
              Ends
              <input
                type="time"
                value={draft.endsAt}
                onChange={(event) =>
                  setDraft({ ...draft, endsAt: event.target.value })
                }
                className={`mt-1 ${inputClassName}`}
              />
            </label>
          </div>

          {error ? <p className="mt-3 text-xs text-coral-strong">{error}</p> : null}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => void add()}
              disabled={saving || !draft.courseCode.trim()}
              className="h-10 rounded-xl bg-ink px-4 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              {saving ? "Saving…" : "Add class"}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="h-10 rounded-xl px-3 text-sm font-semibold text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          <Plus size={14} weight="bold" aria-hidden="true" />
          Add a class
        </button>
      )}
    </div>
  );
}
