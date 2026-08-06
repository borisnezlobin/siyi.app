"use client";

import {
  ArrowSquareOut,
  BellSimple,
  CheckCircle,
  CloudArrowDown,
  DownloadSimple,
  FileCsv,
  FileJs,
  LockKey,
  SignOut,
  SpinnerGap,
  Trash,
  UploadSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { brand } from "@/config/brand";
import { getApiResponseError } from "@/lib/http";
import type { FollowUp, Interaction, Person, RelationshipStrength } from "@/lib/types";
import { importPayloadSchema } from "@/lib/validation";
import { friendlyTimezoneOptions } from "@/lib/timezones";

type ImportPreview = {
  fileName: string;
  payload: unknown;
  counts: {
    people: number;
    interactions: number;
    followUps: number;
    tags: number;
  };
};

function csvCell(value: string | number | null | undefined) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function downloadFile(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function SettingsControls({
  people,
  interactions,
  followUps,
  authMethods,
  initialTimezone,
  initialIntervals,
}: {
  people: Person[];
  interactions: Interaction[];
  followUps: FollowUp[];
  authMethods: string[];
  initialTimezone: string;
  initialIntervals: Record<RelationshipStrength, number>;
}) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [timezone, setTimezone] = useState(initialTimezone);
  const [intervals, setIntervals] = useState(initialIntervals);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState<
    "save" | "password" | "import" | "delete" | null
  >(null);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const availableTimezones = useMemo(
    () => friendlyTimezoneOptions(timezone),
    [timezone],
  );

  async function saveSettings() {
    setWorking("save");
    setMessage("");

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, reminderIntervals: intervals }),
      });
      if (!response.ok) {
        setMessage("Settings could not be saved.");
        setWorking(null);
        return;
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    setMessage("Settings saved.");
    setWorking(null);
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setMessage("");

    if (password.length < 8) {
      setPasswordError("Use at least 8 characters.");
      return;
    }

    if (password !== passwordConfirmation) {
      setPasswordError("The passwords do not match.");
      return;
    }

    setWorking("password");

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, passwordConfirmation }),
      });

      if (!response.ok) {
        setPasswordError(
          await getApiResponseError(response, "The password could not be saved."),
        );
        setWorking(null);
        return;
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }

    setPassword("");
    setPasswordConfirmation("");
    setMessage("Password saved. You can use it the next time you sign in.");
    setWorking(null);
  }

  function exportJson() {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      window.location.assign("/api/export?format=json");
      return;
    }

    downloadFile(
      `${brand.slug}-export.json`,
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          people,
          interactions,
          followUps,
          tags: Array.from(
            new Map(
              people
                .flatMap((person) => person.tags ?? [])
                .map((tag) => [tag.id, tag]),
            ).values(),
          ),
        },
        null,
        2,
      ),
      "application/json",
    );
  }

  function exportPeopleCsv() {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      window.location.assign("/api/export?format=people-csv");
      return;
    }

    const headers = [
      "Full name",
      "Preferred name",
      "Instagram",
      "Phone",
      "Email",
      "Birthday",
      "Major",
      "Residence",
      "First met",
      "Notes",
    ];
    const rows = people.map((person) =>
      [
        person.fullName,
        person.preferredName,
        person.instagramUsername,
        person.phoneNumber,
        person.email,
        person.birthday,
        person.major,
        person.dormOrResidence,
        person.firstMetLocation,
        person.generalNotes,
      ]
        .map(csvCell)
        .join(","),
    );
    downloadFile(
      `${brand.slug}-contacts.csv`,
      [headers.map(csvCell).join(","), ...rows].join("\n"),
      "text/csv",
    );
  }

  function exportInteractionsCsv() {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      window.location.assign("/api/export?format=interactions-csv");
      return;
    }

    const personNames = new Map(people.map((person) => [person.id, person.fullName]));
    const headers = ["Person", "Type", "Occurred at", "Note"];
    const rows = interactions.map((interaction) =>
      [
        personNames.get(interaction.personId),
        interaction.type,
        interaction.occurredAt,
        interaction.note,
      ]
        .map(csvCell)
        .join(","),
    );
    downloadFile(
      `${brand.slug}-interactions.csv`,
      [headers.map(csvCell).join(","), ...rows].join("\n"),
      "text/csv",
    );
  }

  async function previewImport(file: File) {
    setImportError("");
    setImportPreview(null);

    try {
      const parsedJson: unknown = JSON.parse(await file.text());
      const validation = importPayloadSchema.safeParse(parsedJson);
      if (!validation.success) {
        const firstIssue = validation.error.issues[0];
        throw new Error(
          `Could not validate ${firstIssue.path.join(".") || "the file"}: ${firstIssue.message}`,
        );
      }

      setImportPreview({
        fileName: file.name,
        payload: validation.data,
        counts: {
          people: validation.data.people.length,
          interactions: validation.data.interactions.length,
          followUps: validation.data.followUps.length,
          tags: validation.data.tags.length,
        },
      });
    } catch (caughtError) {
      setImportError(
        caughtError instanceof Error
          ? caughtError.message
          : "That file could not be read.",
      );
    }
  }

  async function confirmImport() {
    if (!importPreview) return;
    setWorking("import");
    setImportError("");

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importPreview.payload),
      });
      if (!response.ok) {
        setImportError(
          await getApiResponseError(
            response,
            "The import could not be completed.",
          ),
        );
        setWorking(null);
        return;
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }

    setMessage("Import complete.");
    setImportPreview(null);
    setWorking(null);
  }

  async function deleteAccount() {
    if (deleteConfirmation !== "delete my account") return;
    setWorking("delete");

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) {
        setMessage("The account could not be deleted.");
        setWorking(null);
        return;
      }
    }

    window.location.assign("/auth");
  }

  return (
    <div className="mt-7 space-y-4">
      <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035] sm:p-6">
        <h2 className="text-sm font-bold">Reminder rhythm</h2>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          These defaults apply unless a person has their own interval.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([1, 2, 3, 4] as RelationshipStrength[]).map((strength) => (
            <label key={strength} className="text-[11px] font-semibold text-ink-muted">
              Strength {strength}
              <span className="relative mt-1.5 block">
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={intervals[strength]}
                  onChange={(event) =>
                    setIntervals((currentIntervals) => ({
                      ...currentIntervals,
                      [strength]: Number(event.target.value),
                    }))
                  }
                  className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 pr-11 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-normal">
                  days
                </span>
              </span>
            </label>
          ))}
        </div>
        <div className="mt-4 rounded-2xl bg-porcelain px-4 py-3 text-[11px] leading-5 text-ink-muted">
          Acquaintance: 90 · Getting to know: 45 · Close: 30 · Very close: 14
        </div>
      </section>

      <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035] sm:p-6">
        <h2 className="text-sm font-bold">Local time</h2>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          Used to evaluate reminder dates and delivery times.
        </p>
        <select
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          className="mt-4 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
        >
          {availableTimezones.map((timezoneOption) => (
            <option
              key={timezoneOption.value}
              value={timezoneOption.value}
            >
              {timezoneOption.label}
            </option>
          ))}
        </select>
        <Link
          href="/notifications"
          className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-porcelain px-4 py-3 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          <span className="flex items-center gap-2">
            <BellSimple size={17} className="text-coral" aria-hidden="true" />
            Notification preferences
          </span>
          <ArrowSquareOut size={15} className="text-ink-muted" aria-hidden="true" />
        </Link>
      </section>

      <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035] sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-sage text-sage-strong">
            <CloudArrowDown size={20} weight="fill" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold">Take your data with you</h2>
            <p className="mt-0.5 text-xs text-ink-muted">Download a complete copy anytime.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={exportJson}
            className="flex items-center gap-2 rounded-xl bg-ink px-3 py-3 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            <FileJs size={17} aria-hidden="true" />
            All data as JSON
          </button>
          <button
            type="button"
            onClick={exportPeopleCsv}
            className="flex items-center gap-2 rounded-xl bg-porcelain px-3 py-3 text-xs font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            <FileCsv size={17} aria-hidden="true" />
            Contacts CSV
          </button>
          <button
            type="button"
            onClick={exportInteractionsCsv}
            className="flex items-center gap-2 rounded-xl bg-porcelain px-3 py-3 text-xs font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            <DownloadSimple size={17} aria-hidden="true" />
            Updates CSV
          </button>
        </div>
      </section>

      <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035] sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold">Import from JSON</h2>
            <p className="mt-1 text-xs leading-5 text-ink-muted">
              Files are validated before anything is added.
            </p>
          </div>
          <button
            type="button"
            onClick={() => importInputRef.current?.click()}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-sage text-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            aria-label="Choose JSON file"
          >
            <UploadSimple size={18} weight="bold" aria-hidden="true" />
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void previewImport(file);
            }}
          />
        </div>

        {importPreview ? (
          <div className="mt-4 rounded-2xl bg-sage p-4 text-sage-strong">
            <p className="text-xs font-bold">{importPreview.fileName}</p>
            <p className="mt-1 text-[11px] leading-5">
              Ready to add {importPreview.counts.people} people,{" "}
              {importPreview.counts.interactions} interactions,{" "}
              {importPreview.counts.followUps} follow-ups, and{" "}
              {importPreview.counts.tags} tags.
            </p>
            <button
              type="button"
              onClick={confirmImport}
              disabled={working === "import"}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-sage-strong px-3 py-2.5 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              {working === "import" ? (
                <SpinnerGap size={15} className="animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle size={15} weight="fill" aria-hidden="true" />
              )}
              Confirm import
            </button>
          </div>
        ) : null}

        {importError ? (
          <p role="alert" className="mt-4 flex gap-2 rounded-2xl bg-[#fbe5e0] p-3 text-xs leading-5 text-coral-strong">
            <WarningCircle size={17} className="shrink-0" aria-hidden="true" />
            {importError}
          </p>
        ) : null}
      </section>

      <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035] sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-mist text-ink-muted">
            <LockKey size={19} weight="fill" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold">Sign-in methods</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              {authMethods.join(" and ")}
            </p>
          </div>
        </div>
        <form onSubmit={savePassword} className="mt-5 rounded-2xl bg-porcelain p-4">
          <h3 className="text-xs font-bold">Create or change your password</h3>
          <p className="mt-1 text-[11px] leading-5 text-ink-muted">
            Since you are already signed in, this does not need an email link.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-[11px] font-semibold text-ink-muted">
              New password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                maxLength={72}
                required
                autoComplete="new-password"
                className="mt-1.5 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
              />
            </label>
            <label className="text-[11px] font-semibold text-ink-muted">
              Confirm password
              <input
                type="password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                minLength={8}
                maxLength={72}
                required
                autoComplete="new-password"
                className="mt-1.5 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
              />
            </label>
          </div>
          {passwordError ? (
            <p role="alert" className="mt-3 text-[11px] font-semibold text-coral-strong">
              {passwordError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={working === "password"}
            className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            {working === "password" ? (
              <SpinnerGap size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <LockKey size={16} weight="fill" aria-hidden="true" />
            )}
            Save password
          </button>
        </form>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-porcelain px-4 py-3 text-xs font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            <SignOut size={17} aria-hidden="true" />
            Sign out
          </button>
        </form>
      </section>

      {message ? (
        <p role="status" className="rounded-2xl bg-sage px-4 py-3 text-xs font-semibold text-sage-strong">
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={saveSettings}
        disabled={working === "save"}
        className="flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 text-sm font-semibold text-white shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
      >
        {working === "save" ? (
          <SpinnerGap size={18} className="animate-spin" aria-hidden="true" />
        ) : null}
        Save settings
      </button>

      <section className="rounded-[1.75rem] bg-[#fbe5e0] p-5 text-coral-strong">
        <h2 className="text-sm font-bold">Delete account</h2>
        <p className="mt-1 text-xs leading-5">
          Permanently removes your account, people, notes, photos, interactions,
          follow-ups, and push subscriptions.
        </p>
        {!deleteOpen ? (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-coral-strong px-4 py-3 text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            <Trash size={16} aria-hidden="true" />
            Start account deletion
          </button>
        ) : (
          <div className="mt-4">
            <label className="block text-xs font-semibold">
              Type “delete my account” to confirm
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                className="mt-1.5 h-11 w-full rounded-xl border border-coral/25 bg-white px-3 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
              />
            </label>
            <button
              type="button"
              onClick={deleteAccount}
              disabled={
                deleteConfirmation !== "delete my account" || working === "delete"
              }
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-coral-strong px-4 py-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              <Trash size={16} aria-hidden="true" />
              Delete everything
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
