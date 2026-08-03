"use client";

import { Check, SpinnerGap } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiResponseError } from "@/lib/http";
import { normalizeInstagramUsername } from "@/lib/instagram";
import type { Person } from "@/lib/types";

const inputClassName =
  "mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition focus:border-coral focus:ring-2 focus:ring-coral/20";
const labelClassName = "block text-xs font-semibold text-ink-muted";

export function EditPersonForm({ person }: { person: Person }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const formData = new FormData(event.currentTarget);
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
      reminderIntervalDays: formData.get("reminderIntervalDays") || null,
      status: formData.get("status"),
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

    router.push(`/people/${person.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-7">
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
            defaultValue={person.phoneNumber ?? ""}
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
        <label className={labelClassName}>
          Relationship
          <select
            name="relationshipStrength"
            defaultValue={person.relationshipStrength}
            className={inputClassName}
          >
            <option value="1">Acquaintance</option>
            <option value="2">Getting to know</option>
            <option value="3">Close</option>
            <option value="4">Very close</option>
          </select>
        </label>
        <label className={labelClassName}>
          Reminder interval
          <input
            name="reminderIntervalDays"
            type="number"
            min="1"
            max="3650"
            defaultValue={person.reminderIntervalDays ?? ""}
            className={inputClassName}
          />
        </label>
        <label className={labelClassName}>
          Reminder status
          <select name="status" defaultValue={person.status} className={inputClassName}>
            <option value="active">Active</option>
            <option value="muted">Muted</option>
            <option value="archived">Archived</option>
          </select>
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
    </form>
  );
}
