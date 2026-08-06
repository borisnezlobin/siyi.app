"use client";

import { formatPhoneNumberInput } from "@/lib/phone-format";
import { Check, SpinnerGap } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  timestampFromDateInput,
  toDateInputValue,
  todayDateInputValue,
} from "@/lib/date-input";
import { hasUnsavedChanges, type FormValues } from "@/lib/form-changes";
import { getApiResponseError } from "@/lib/http";
import { normalizeInstagramUsername } from "@/lib/instagram";
import { RelationshipFields } from "@/components/relationship-fields";
import { relationshipLabelFor } from "@/lib/relationship-labels";
import type { Person } from "@/lib/types";

const inputClassName =
  "mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20";
const labelClassName = "block text-xs font-semibold text-ink-muted";

function initialFormValues(person: Person): FormValues {
  return {
    fullName: person.fullName,
    preferredName: person.preferredName ?? "",
    instagramUsername: person.instagramUsername ?? "",
    phoneNumber: formatPhoneNumberInput(person.phoneNumber ?? ""),
    email: person.email ?? "",
    birthday: person.birthday ?? "",
    hometown: person.hometown ?? "",
    dormOrResidence: person.dormOrResidence ?? "",
    major: person.major ?? "",
    graduationYear: person.graduationYear ? String(person.graduationYear) : "",
    relationshipStrength: String(person.relationshipStrength),
    relationshipLabel: relationshipLabelFor(person),
    remindersEnabled: person.remindersEnabled ? "true" : "false",
    reminderIntervalDays: person.reminderIntervalDays
      ? String(person.reminderIntervalDays)
      : "",
    status: person.status,
    firstMetAt: toDateInputValue(person.firstMetAt),
    firstMetLocation: person.firstMetLocation ?? "",
    generalNotes: person.generalNotes ?? "",
  };
}

function readFormValues(form: HTMLFormElement): FormValues {
  return Object.fromEntries(
    [...new FormData(form).entries()].map(([name, value]) => [
      name,
      String(value),
    ]),
  );
}

export function EditPersonForm({ person }: { person: Person }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const discardDialogRef = useRef<HTMLDialogElement>(null);
  const pendingDestinationRef = useRef(`/people/${person.id}`);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const initialValues = useMemo(() => initialFormValues(person), [person]);
  const today = todayDateInputValue();

  useEffect(() => {
    if (!dirty) return;

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    // Client-side navigations never reach beforeunload, so links have to be
    // caught on the way out and replayed once the change is confirmed.
    const confirmBeforeLeaving = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const link = (event.target as HTMLElement | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      const destination = link.getAttribute("href");
      if (!destination || destination.startsWith("#") || link.target) return;

      event.preventDefault();
      pendingDestinationRef.current = destination;
      discardDialogRef.current?.showModal();
    };

    window.addEventListener("beforeunload", warnBeforeUnload);
    document.addEventListener("click", confirmBeforeLeaving, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeUnload);
      document.removeEventListener("click", confirmBeforeLeaving, true);
    };
  }, [dirty]);

  function refreshDirtyState() {
    const form = formRef.current;
    if (!form) return;
    setDirty(hasUnsavedChanges(initialValues, readFormValues(form)));
  }

  function leaveWithoutSaving() {
    setDirty(false);
    discardDialogRef.current?.close();
    router.push(pendingDestinationRef.current);
  }

  function requestLeave() {
    pendingDestinationRef.current = `/people/${person.id}`;
    if (!dirty) {
      router.push(pendingDestinationRef.current);
      return;
    }
    discardDialogRef.current?.showModal();
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const firstMetDate = String(formData.get("firstMetAt") ?? "");
    const payload = {
      fullName: formData.get("fullName"),
      preferredName: formData.get("preferredName"),
      instagramUsername: normalizeInstagramUsername(
        String(formData.get("instagramUsername") ?? ""),
      ),
      phoneNumber: formData.get("phoneNumber"),
      email: formData.get("email"),
      birthday: formData.get("birthday"),
      hometown: formData.get("hometown"),
      dormOrResidence: formData.get("dormOrResidence"),
      major: formData.get("major"),
      graduationYear: formData.get("graduationYear") || null,
      relationshipStrength: Number(formData.get("relationshipStrength")),
      relationshipLabel: formData.get("relationshipLabel") || null,
      remindersEnabled: formData.get("remindersEnabled") !== "false",
      reminderIntervalDays: formData.get("reminderIntervalDays") || null,
      status: formData.get("status"),
      firstMetAt:
        firstMetDate === initialValues.firstMetAt
          ? person.firstMetAt
          : timestampFromDateInput(firstMetDate),
      firstMetLocation: formData.get("firstMetLocation"),
      generalNotes: formData.get("generalNotes"),
    };

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch(`/api/people/${person.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError(
          await getApiResponseError(response, "Changes could not be saved."),
        );
        setSaving(false);
        return;
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 300));
    }

    setDirty(false);
    router.push(`/people/${person.id}`);
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onInput={refreshDirtyState}
      onChange={refreshDirtyState}
      className="mt-7"
    >
      <section className="grid gap-4 rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035] sm:grid-cols-2 sm:p-6">
        <label className={`${labelClassName} sm:col-span-2`}>
          Full name
          <input
            name="fullName"
            required
            defaultValue={person.fullName}
            className={inputClassName}
          />
        </label>
        <label className={labelClassName}>
          Preferred name
          <input
            name="preferredName"
            defaultValue={person.preferredName ?? ""}
            className={inputClassName}
          />
        </label>
        <label className={labelClassName}>
          Instagram
          <input
            name="instagramUsername"
            defaultValue={person.instagramUsername ?? ""}
            className={inputClassName}
          />
        </label>
        <label className={labelClassName}>
          Phone
          <input
            name="phoneNumber"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="(555) 555-0123"
            defaultValue={formatPhoneNumberInput(person.phoneNumber ?? "")}
            onChange={(event) => {
              event.currentTarget.value = formatPhoneNumberInput(
                event.currentTarget.value,
              );
            }}
            className={inputClassName}
          />
        </label>
        <label className={labelClassName}>
          Email
          <input
            name="email"
            type="email"
            defaultValue={person.email ?? ""}
            className={inputClassName}
          />
        </label>
        <label className={labelClassName}>
          Birthday
          <input
            name="birthday"
            type="date"
            defaultValue={person.birthday ?? ""}
            className={inputClassName}
          />
        </label>
        <label className={labelClassName}>
          Hometown
          <input
            name="hometown"
            defaultValue={person.hometown ?? ""}
            className={inputClassName}
          />
        </label>
        <label className={labelClassName}>
          Dorm or residence
          <input
            name="dormOrResidence"
            defaultValue={person.dormOrResidence ?? ""}
            className={inputClassName}
          />
        </label>
        <label className={labelClassName}>
          Major
          <input
            name="major"
            defaultValue={person.major ?? ""}
            className={inputClassName}
          />
        </label>
        <label className={labelClassName}>
          Graduation year
          <input
            name="graduationYear"
            type="number"
            min="1900"
            max="2200"
            defaultValue={person.graduationYear ?? ""}
            className={inputClassName}
          />
        </label>
        <RelationshipFields
          personName={person.preferredName ?? person.fullName}
          defaultStrength={person.relationshipStrength}
          defaultLabel={person.relationshipLabel}
          defaultRemindersEnabled={person.remindersEnabled}
          defaultReminderIntervalDays={person.reminderIntervalDays}
        />
        <label className={labelClassName}>
          Reminder status
          <select name="status" defaultValue={person.status} className={inputClassName}>
            <option value="active">Active</option>
            <option value="muted">Muted</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className={labelClassName}>
          First met
          <input
            name="firstMetAt"
            type="date"
            max={today}
            defaultValue={initialValues.firstMetAt}
            className={inputClassName}
          />
        </label>
        <label className={`${labelClassName} sm:col-span-2`}>
          Where you met
          <input
            name="firstMetLocation"
            defaultValue={person.firstMetLocation ?? ""}
            className={inputClassName}
          />
        </label>
        <label className={`${labelClassName} sm:col-span-2`}>
          Notes
          <textarea
            name="generalNotes"
            rows={5}
            defaultValue={person.generalNotes ?? ""}
            className="mt-1.5 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
        </label>
      </section>

      {error ? (
        <p role="alert" className="mt-4 rounded-2xl bg-[#fbe5e0] px-4 py-3 text-sm text-coral-strong">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 text-sm font-bold text-white shadow-float transition-colors hover:bg-coral-strong disabled:cursor-wait disabled:bg-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
      >
        {saving ? (
          <SpinnerGap size={18} className="animate-spin" aria-hidden="true" />
        ) : (
          <Check size={18} weight="bold" aria-hidden="true" />
        )}
        {saving ? "Saving…" : "Save changes"}
      </button>

      <button
        type="button"
        onClick={requestLeave}
        className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold text-ink-muted transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        Cancel
      </button>

      <dialog
        ref={discardDialogRef}
        className="m-auto w-[min(400px,calc(100vw-2rem))] rounded-[1.5rem] bg-white p-6 text-ink shadow-float backdrop:bg-ink/40"
        aria-labelledby={`discard-changes-${person.id}`}
      >
        <h2
          id={`discard-changes-${person.id}`}
          className="font-display text-2xl leading-none"
        >
          Leave without saving?
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          You have edits here that have not been saved yet.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => discardDialogRef.current?.close()}
            className="flex h-12 items-center justify-center rounded-2xl bg-porcelain text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={leaveWithoutSaving}
            className="flex h-12 items-center justify-center rounded-2xl bg-coral text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            Discard changes
          </button>
        </div>
      </dialog>
    </form>
  );
}
