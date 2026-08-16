"use client";

import { SpinnerGap } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { brand } from "@/config/brand";
import { getApiResponseError } from "@/lib/http";
import { friendlyTimezoneOptions } from "@/lib/timezones";

// Signup already asked for a name, so the field only appears for the accounts
// that arrived without one — a provider sign-in that handed over no profile.
export function OnboardingForm({ knownName }: { knownName: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(knownName);
  const [timezone, setTimezone] = useState("UTC");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  }, []);

  const timezoneOptions = useMemo(
    () => friendlyTimezoneOptions(timezone),
    [timezone],
  );

  async function finish(setUpNotifications: boolean) {
    if (!displayName.trim()) {
      setNameError("Add the name we should call you.");
      return;
    }
    if (!timezone.trim()) {
      setError("Choose the city or timezone closest to you.");
      return;
    }

    setSaving(true);
    setNameError("");
    setError("");

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          timezone,
          locale: navigator.language || "en-US",
          // Every category starts on; the notifications screen is where they
          // are turned off, on both platforms.
          overdueContactEnabled: true,
          birthdayEnabled: true,
          reminderEnabled: true,
          pushEnabled: false,
        }),
      });

      if (!response.ok) {
        setError(
          await getApiResponseError(response, "Your setup could not be saved."),
        );
        setSaving(false);
        return;
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }

    router.push(setUpNotifications ? "/notifications" : "/today");
    router.refresh();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void finish(true);
      }}
      className="mt-8 space-y-7"
    >
      {knownName ? null : (
        <label className="block text-xs font-semibold text-ink-muted">
          Your name
          <input
            autoFocus
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              if (nameError) setNameError("");
            }}
            autoComplete="name"
            placeholder="What should we call you?"
            className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
          {nameError ? (
            <span className="mt-1.5 block text-xs font-normal text-coral-strong">
              {nameError}
            </span>
          ) : null}
        </label>
      )}

      <label className="block text-sm font-semibold">
        Your local time
        <span className="mt-1 block text-xs font-normal leading-5 text-ink-muted">
          Used for birthdays and reminder timing.
        </span>
        <select
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
          className="mt-2 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-normal text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
        >
          {timezoneOptions.map((timezoneOption) => (
            <option key={timezoneOption.value} value={timezoneOption.value}>
              {timezoneOption.label}
            </option>
          ))}
        </select>
      </label>

      <section>
        <h2 className="text-sm font-bold">Gentle reminders, on your terms</h2>
        <p className="mt-1.5 max-w-lg text-sm leading-6 text-ink-muted">
          {brand.name} can surface due reminders, birthdays, and people you meant
          to check in with. We will only ask for permission after you choose
          &ldquo;Set up notifications&rdquo;.
        </p>
        <p className="mt-2 max-w-lg text-xs leading-5 text-ink-muted">
          Notification categories and quiet timing stay under your control.
        </p>
      </section>

      {error ? (
        <p role="alert" className="text-xs leading-5 text-coral-strong">
          {error}
        </p>
      ) : null}

      <div className="space-y-2.5">
        <button
          type="submit"
          disabled={saving}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 text-sm font-semibold text-white transition-colors hover:bg-coral-strong disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          {saving ? (
            <SpinnerGap size={18} className="animate-spin" aria-hidden="true" />
          ) : null}
          Set up notifications
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void finish(false)}
          className="flex h-12 w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold text-ink transition-colors hover:bg-ink/[0.05] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          Maybe later
        </button>
      </div>
    </form>
  );
}
