"use client";

import { CollegeInput } from "@/components/college-input";
import { DateField } from "@/components/date-field";
import { Camera, Check, ImageSquare, SpinnerGap, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { ContactFields } from "@/components/contact-fields";
import {
  contactFormValues,
  initialContactDrafts,
  parseContactDraftsJson,
} from "@/lib/contact-methods";
import { FormSection } from "@/components/form-section";
import { PersonNoteSections } from "@/components/person-note-sections";
import { RelationshipFields } from "@/components/relationship-fields";
import {
  timestampFromDateInput,
  toDateInputValue,
  todayDateInputValue,
} from "@/lib/date-input";
import { hasUnsavedChanges, type FormValues } from "@/lib/form-changes";
import { getApiResponseError } from "@/lib/http";
import { normalizeInstagramUsername } from "@/lib/instagram";
import { relationshipLabelFor } from "@/lib/relationship-labels";
import { createClient } from "@/lib/supabase/client";
import type { PersonNote, Person } from "@/lib/types";

const inputClassName =
  "mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20";
const labelClassName = "block text-xs font-semibold text-ink-muted";

function initialFormValues(person: Person): FormValues {
  return {
    fullName: person.fullName,
    preferredName: person.preferredName ?? "",
    ...contactFormValues(initialContactDrafts(person)),
    birthday: person.birthday ?? "",
    hometown: person.hometown ?? "",
    dormOrResidence: person.dormOrResidence ?? "",
    university: person.university ?? "",
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

/** Collapsed headers have to say what is inside, so nobody has to open all
 * six looking for one field. */
function listFilled(entries: [string, string | undefined][], empty: string) {
  const filled = entries
    .filter(([, value]) => Boolean(value?.trim()))
    .map(([label]) => label);
  return filled.length ? filled.join(" · ") : empty;
}

export function EditPersonForm({
  person,
  noteSections = [],
  noteSectionsAvailable = false,
  headingsUsedElsewhere = [],
}: {
  person: Person;
  noteSections?: PersonNote[];
  noteSectionsAvailable?: boolean;
  headingsUsedElsewhere?: string[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const discardDialogRef = useRef<HTMLDialogElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const pendingDestinationRef = useRef(`/people/${person.id}`);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const initialValues = useMemo(() => initialFormValues(person), [person]);
  const [values, setValues] = useState<FormValues>(initialValues);
  const [namedSectionCount, setNamedSectionCount] = useState(
    noteSections.length,
  );
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const today = todayDateInputValue();

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photoFile]);

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

  // The contact rows live in React state, so their hidden fields trail one
  // render behind a keystroke. Passing the new values in directly keeps the
  // unsaved-changes warning honest.
  function refreshDirtyState(overrides?: FormValues) {
    const form = formRef.current;
    if (!form) return;
    const current = { ...readFormValues(form), ...overrides };
    setValues(current);
    setDirty(Boolean(photoFile) || hasUnsavedChanges(initialValues, current));
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

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Sign in again before uploading a photo.");
    }

    const fileExtension = photoFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const filePath = `${user.id}/${crypto.randomUUID()}.${fileExtension}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, photoFile, {
        cacheControl: "3600",
        contentType: photoFile.type,
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);
    return filePath;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const firstMetDate = String(formData.get("firstMetAt") ?? "");

    let profilePhotoUrl: string | null = null;
    try {
      profilePhotoUrl = await uploadPhoto();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The photo could not be uploaded.",
      );
      setSaving(false);
      return;
    }

    const payload = {
      fullName: formData.get("fullName"),
      preferredName: formData.get("preferredName"),
      contactMethods: parseContactDraftsJson(formData.get("contactMethods")),
      instagramUsername: normalizeInstagramUsername(
        String(formData.get("instagramUsername") ?? ""),
      ),
      phoneNumber: formData.get("phoneNumber"),
      email: formData.get("email"),
      birthday: formData.get("birthday"),
      hometown: formData.get("hometown"),
      dormOrResidence: formData.get("dormOrResidence"),
      university: formData.get("university"),
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
      ...(profilePhotoUrl ? { profilePhotoUrl } : {}),
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

  const displayName = values.preferredName?.trim() || values.fullName || "Them";

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      onInput={() => refreshDirtyState()}
      onChange={() => refreshDirtyState()}
      className="mt-7 space-y-3"
    >
      <FormSection
        title="Who they are"
        summary={displayName}
        defaultOpen
      >
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
            aria-label="Change profile photo"
          >
            {photoPreviewUrl || person.profilePhotoUrl ? (
              <Avatar
                name={values.fullName || person.fullName}
                imageUrl={photoPreviewUrl ?? person.profilePhotoUrl}
                size="lg"
              />
            ) : (
              <span className="grid size-16 place-items-center rounded-full bg-mist text-ink-muted">
                <Camera size={24} aria-hidden="true" />
              </span>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full bg-ink text-white ring-2 ring-white">
              <ImageSquare size={12} weight="fill" aria-hidden="true" />
            </span>
          </button>
          <div>
            <p className="text-sm font-bold">Photo</p>
            <p className="mt-1 text-xs leading-5 text-ink-muted">
              {photoFile
                ? "This one saves with your changes."
                : "Tap to pick a new one."}
            </p>
            {photoFile ? (
              <button
                type="button"
                onClick={() => setPhotoFile(null)}
                className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <X size={12} aria-hidden="true" />
                Undo
              </button>
            ) : null}
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="sr-only"
            onChange={(event) => {
              setPhotoFile(event.target.files?.[0] ?? null);
              setDirty(true);
            }}
          />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className={`${labelClassName} sm:col-span-2`}>
            Full name
            <input
              name="fullName"
              required
              defaultValue={person.fullName}
              className={inputClassName}
            />
          </label>
          <label className={`${labelClassName} sm:col-span-2`}>
            Preferred name
            <input
              name="preferredName"
              defaultValue={person.preferredName ?? ""}
              className={inputClassName}
            />
          </label>
        </div>
      </FormSection>

      <FormSection
        title="How to reach them"
        summary={listFilled(
          [
            ["Phone", values.phoneNumber],
            ["Email", values.email],
            ["Instagram", values.instagramUsername],
          ],
          "Nothing saved yet",
        )}
      >
        <ContactFields
          drafts={initialContactDrafts(person)}
          onChange={(drafts) => refreshDirtyState(contactFormValues(drafts))}
        />
      </FormSection>

      <FormSection
        title="About them"
        summary={listFilled(
          [
            ["Hometown", values.hometown],
            ["University", values.university],
            ["Major", values.major],
            ["Class year", values.graduationYear],
            ["Residence", values.dormOrResidence],
            ["Birthday", values.birthday],
          ],
          "Nothing saved yet",
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClassName}>
            Hometown
            <input
              name="hometown"
              defaultValue={person.hometown ?? ""}
              className={inputClassName}
            />
          </label>
          <label className={labelClassName}>
            University
            <CollegeInput
              defaultValue={person.university ?? ""}
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
              inputMode="numeric"
              defaultValue={person.graduationYear ?? ""}
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
          <DateField
            className="sm:col-span-2"
            defaultValue={person.birthday ?? ""}
            inputClassName={inputClassName}
            label="Birthday"
            name="birthday"
          />
        </div>
      </FormSection>

      <FormSection
        title="How you met"
        summary={listFilled(
          [
            ["Date", values.firstMetAt],
            ["Place", values.firstMetLocation],
          ],
          "Nothing saved yet",
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <DateField
            defaultValue={initialValues.firstMetAt}
            inputClassName={inputClassName}
            label="When did you meet?"
            max={today}
            name="firstMetAt"
          />
          <label className={labelClassName}>
            Where did you meet?
            <input
              name="firstMetLocation"
              placeholder="Birch Hall lounge"
              defaultValue={person.firstMetLocation ?? ""}
              className={inputClassName}
            />
          </label>
        </div>
      </FormSection>

      <FormSection
        title="Notes"
        summary={
          namedSectionCount
            ? `${namedSectionCount} ${namedSectionCount === 1 ? "section" : "sections"}`
            : values.generalNotes?.trim()
              ? "Written down"
              : "Nothing saved yet"
        }
      >
        <label className={labelClassName}>
          Short note
          <textarea
            name="generalNotes"
            rows={5}
            maxLength={1000}
            placeholder="What were you talking about? Anything to remember?"
            defaultValue={person.generalNotes ?? ""}
            className="mt-1.5 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
        </label>
        <PersonNoteSections
          personId={person.id}
          available={noteSectionsAvailable}
          initialSections={noteSections}
          headingsUsedElsewhere={headingsUsedElsewhere}
          onSectionCountChange={setNamedSectionCount}
        />
      </FormSection>

      <FormSection
        title="Reminders"
        summary={`${values.relationshipLabel || relationshipLabelFor(person)} · ${
          values.remindersEnabled === "false" ? "Nudges off" : "Nudges on"
        }`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <RelationshipFields
            personName={person.preferredName ?? person.fullName}
            defaultStrength={person.relationshipStrength}
            defaultLabel={person.relationshipLabel}
            defaultRemindersEnabled={person.remindersEnabled}
            defaultReminderIntervalDays={person.reminderIntervalDays}
            onValuesChange={refreshDirtyState}
          />
          <label className={`${labelClassName} sm:col-span-2`}>
            Reminder status
            <select
              name="status"
              defaultValue={person.status}
              className={inputClassName}
            >
              <option value="active">Active</option>
              <option value="muted">Muted</option>
              <option value="archived">Archived</option>
            </select>
          </label>
        </div>
      </FormSection>

      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fbe5e0] px-4 py-3 text-sm text-coral-strong">
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
        className="flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold text-ink-muted transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
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
