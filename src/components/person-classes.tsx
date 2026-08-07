"use client";

import { Plus, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { courseOptions, type PersonClass } from "@/lib/classes";
import { getApiResponseError } from "@/lib/http";

const inputClassName =
  "mt-1 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";

/**
 * The classes somebody is taking: a course and who teaches it.
 *
 * Deliberately just those two. A course rarely meets at the same time every day,
 * so a timetable is a lot of typing for something that ends up wrong — and who
 * you share a class with is the part worth knowing anyway.
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
  const [draft, setDraft] = useState({ courseCode: "", professor: "" });

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
      setDraft({ courseCode: "", professor: "" });
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
                </span>
                <span className="block truncate text-xs text-ink-muted">
                  {entry.professor ?? "No professor saved"}
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
                className={inputClassName}
              />
              <datalist id="known-courses">
                {options.map((option) => (
                  <option key={option.code} value={option.code} />
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
                className={inputClassName}
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
