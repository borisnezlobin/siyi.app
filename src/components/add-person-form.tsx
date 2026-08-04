"use client";

import {
  Camera,
  CaretDown,
  Check,
  ImageSquare,
  SpinnerGap,
  X,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { getApiResponseError, readJsonResponse } from "@/lib/http";
import { normalizeInstagramUsername } from "@/lib/instagram";
import { createClient } from "@/lib/supabase/client";

const inputClassName =
  "mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";
const labelClassName = "block text-xs font-semibold text-ink-muted";

export function AddPersonForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [instagramUsername, setInstagramUsername] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [photoFile]);

  async function uploadPhoto(): Promise<string | null> {
    if (!photoFile || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      return null;
    }

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

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    return filePath;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Add their name before saving.");
      return;
    }

    setSaving(true);

    try {
      const formData = new FormData(event.currentTarget);
      const profilePhotoUrl = await uploadPhoto();
      const payload = {
        fullName,
        instagramUsername,
        phoneNumber: formData.get("phoneNumber"),
        firstMetLocation: formData.get("firstMetLocation"),
        generalNotes: formData.get("generalNotes"),
        preferredName: formData.get("preferredName"),
        email: formData.get("email"),
        birthday: formData.get("birthday"),
        hometown: formData.get("hometown"),
        dormOrResidence: formData.get("dormOrResidence"),
        major: formData.get("major"),
        graduationYear: formData.get("graduationYear") || null,
        relationshipStrength: Number(formData.get("relationshipStrength") || 2),
        reminderIntervalDays: formData.get("reminderIntervalDays") || null,
        status: "active",
        profilePhotoUrl,
        firstMetAt: new Date().toISOString(),
      };

      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const response = await fetch("/api/people", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(
            await getApiResponseError(
              response,
              "The person could not be saved.",
            ),
          );
        }

        const result = await readJsonResponse<{
          person?: { id: string };
          error?: string;
        }>(response);

        if (!result?.person) {
          throw new Error("The app returned an unexpected response. Try again.");
        }

        router.push(`/people/${result.person.id}`);
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        router.push("/people?added=1");
      }

      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "The person could not be saved.",
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <section className="mt-7 rounded-[1.75rem] bg-white p-4 shadow-card ring-1 ring-black/[0.035] sm:p-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
            aria-label={photoFile ? "Change profile photo" : "Add profile photo"}
          >
            {photoFile ? (
              <Avatar
                name={fullName || "New person"}
                imageUrl={photoPreviewUrl}
                size="lg"
              />
            ) : (
              <span className="grid size-16 place-items-center rounded-full bg-sage text-sage-strong">
                <Camera size={24} weight="fill" aria-hidden="true" />
              </span>
            )}
            <span className="absolute -bottom-0.5 -right-0.5 grid size-6 place-items-center rounded-full bg-ink text-white ring-2 ring-white">
              <ImageSquare size={12} weight="fill" aria-hidden="true" />
            </span>
          </button>
          <div>
            <p className="text-sm font-bold">Add a photo</p>
            <p className="mt-1 text-xs leading-5 text-ink-muted">
              Optional, but useful when you just met.
            </p>
            {photoFile ? (
              <button
                type="button"
                onClick={() => setPhotoFile(null)}
                className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <X size={12} aria-hidden="true" />
                Remove
              </button>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            className="sr-only"
            onChange={(event) => setPhotoFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <div className="mt-6 space-y-4">
          <label className={labelClassName}>
            Name
            <input
              autoFocus
              required
              autoComplete="name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Jordan Lee"
              className={inputClassName}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClassName}>
              Instagram
              <input
                value={instagramUsername}
                onChange={(event) => setInstagramUsername(event.target.value)}
                onBlur={() =>
                  setInstagramUsername(normalizeInstagramUsername(instagramUsername))
                }
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="text"
                placeholder="@username or profile link"
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
                className={inputClassName}
              />
            </label>
          </div>

          <label className={labelClassName}>
            Where did you meet?
            <input
              name="firstMetLocation"
              placeholder="Birch Hall lounge"
              className={inputClassName}
            />
          </label>

          <label className={labelClassName}>
            Short note
            <textarea
              name="generalNotes"
              rows={3}
              maxLength={1000}
              placeholder="What were you talking about? Anything to remember?"
              className="mt-1.5 w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
            />
          </label>
        </div>
      </section>

      <details className="group mt-4 rounded-[1.5rem] bg-white shadow-card ring-1 ring-black/[0.035]">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-3xl px-4 py-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral sm:px-6">
          More details
          <CaretDown
            size={17}
            className="text-ink-muted transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="grid gap-4 px-4 pb-5 sm:grid-cols-2 sm:px-6 sm:pb-6">
          <label className={labelClassName}>
            Preferred name
            <input name="preferredName" className={inputClassName} />
          </label>
          <label className={labelClassName}>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              className={inputClassName}
            />
          </label>
          <label className={labelClassName}>
            Birthday
            <input name="birthday" type="date" className={inputClassName} />
          </label>
          <label className={labelClassName}>
            Hometown
            <input name="hometown" className={inputClassName} />
          </label>
          <label className={labelClassName}>
            Dorm or residence
            <input name="dormOrResidence" className={inputClassName} />
          </label>
          <label className={labelClassName}>
            Major
            <input name="major" className={inputClassName} />
          </label>
          <label className={labelClassName}>
            Graduation year
            <input
              name="graduationYear"
              type="number"
              min="1900"
              max="2200"
              inputMode="numeric"
              className={inputClassName}
            />
          </label>
          <label className={labelClassName}>
            Relationship
            <select
              name="relationshipStrength"
              defaultValue="2"
              className={inputClassName}
            >
              <option value="1">Acquaintance</option>
              <option value="2">Getting to know</option>
              <option value="3">Close</option>
              <option value="4">Very close</option>
            </select>
          </label>
          <label className={`${labelClassName} sm:col-span-2`}>
            Custom reminder interval
            <span className="mt-1 block text-[11px] font-normal leading-4 text-ink-muted">
              Leave blank to use the default for this relationship.
            </span>
            <div className="relative">
              <input
                name="reminderIntervalDays"
                type="number"
                min="1"
                max="3650"
                inputMode="numeric"
                className={`${inputClassName} pr-14`}
              />
              <span className="absolute right-4 top-[1.15rem] text-xs text-ink-muted">
                days
              </span>
            </div>
          </label>
        </div>
      </details>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-2xl bg-[#fbe5e0] px-4 py-3 text-sm font-medium text-coral-strong"
        >
          {error}
        </p>
      ) : null}

      <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 -mx-4 mt-6 bg-porcelain/95 px-4 py-3 backdrop-blur-sm lg:bottom-0 lg:mx-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
        <button
          type="submit"
          disabled={saving}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 text-sm font-bold text-white shadow-float transition-colors hover:bg-coral-strong disabled:cursor-wait disabled:bg-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          {saving ? (
            <>
              <SpinnerGap size={19} className="animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            <>
              <Check size={18} weight="bold" aria-hidden="true" />
              Save person
            </>
          )}
        </button>
      </div>
    </form>
  );
}
