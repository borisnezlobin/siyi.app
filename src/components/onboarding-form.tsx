"use client";

import {
  ArrowRight,
  BellRinging,
  Check,
  Clock,
  SpinnerGap,
  UsersThree,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { SwitchControl } from "@/components/switch-control";
import { getApiResponseError } from "@/lib/http";
import { friendlyTimezoneOptions } from "@/lib/timezones";

export function OnboardingForm() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [overdueContactEnabled, setOverdueContactEnabled] = useState(true);
  const [birthdayEnabled, setBirthdayEnabled] = useState(true);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    setPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  const timezoneOptions = useMemo(
    () => friendlyTimezoneOptions(timezone),
    [timezone],
  );

  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
  }

  async function finishOnboarding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!displayName.trim()) {
      setError("Add the name you want friends to see.");
      return;
    }

    setSaving(true);

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          timezone,
          locale: navigator.language || "en-US",
          overdueContactEnabled,
          birthdayEnabled,
          reminderEnabled,
          pushEnabled: permission === "granted",
        }),
      });

      if (!response.ok) {
        setError(
          await getApiResponseError(
            response,
            "Your setup could not be saved.",
          ),
        );
        setSaving(false);
        return;
      }
    } else {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }

    router.push("/today");
    router.refresh();
  }

  return (
    <form onSubmit={finishOnboarding} className="mt-8 space-y-4">
      <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035] sm:p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-sage text-sage-strong">
            <UsersThree size={20} weight="fill" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold">A little about you</p>
            <p className="mt-0.5 text-xs text-ink-muted">You can change this later.</p>
          </div>
        </div>
        <label className="mt-5 block text-xs font-semibold text-ink-muted">
          Your name
          <input
            autoFocus
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="name"
            placeholder="Alex Vale"
            className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
          />
        </label>
        <label className="mt-4 block text-xs font-semibold text-ink-muted">
          Timezone
          <select
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/20"
          >
            {timezoneOptions.map((timezoneOption) => (
              <option
                key={timezoneOption.value}
                value={timezoneOption.value}
              >
                {timezoneOption.label}
              </option>
            ))}
          </select>
          <span className="mt-1.5 flex items-center gap-1 text-[10px] font-normal text-ink-muted">
            <Clock size={12} aria-hidden="true" />
            Detected from this device. Choose another if needed.
          </span>
        </label>
      </section>

      <section className="rounded-[1.75rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035] sm:p-6">
        <h2 className="text-sm font-bold">Start with useful reminders</h2>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          These are calm defaults, not commitments. Turn any category off now or
          later.
        </p>
        <div className="mt-2 divide-y divide-black/[0.055]">
          <SwitchControl
            checked={overdueContactEnabled}
            onChange={setOverdueContactEnabled}
            label="People you meant to contact"
          />
          <SwitchControl
            checked={birthdayEnabled}
            onChange={setBirthdayEnabled}
            label="Upcoming birthdays"
          />
          <SwitchControl
            checked={reminderEnabled}
            onChange={setReminderEnabled}
            label="Open reminders"
          />
        </div>
      </section>

      <section className="rounded-[1.75rem] bg-ink p-5 text-white shadow-float sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 text-sun">
            <BellRinging size={22} weight="fill" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold">Notifications are your choice</h2>
            <p className="mt-2 text-xs leading-5 text-white/62">
              If enabled, this browser can send the reminder categories you chose.
              Permission is requested only after you press the button below.
            </p>
            <button
              type="button"
              onClick={requestNotificationPermission}
              disabled={permission === "granted" || permission === "unsupported"}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-semibold text-ink transition-colors hover:bg-sage disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
            >
              {permission === "granted" ? (
                <>
                  <Check size={16} weight="bold" aria-hidden="true" />
                  Permission allowed
                </>
              ) : permission === "unsupported" ? (
                "Not supported here"
              ) : (
                "Allow notifications"
              )}
            </button>
            {permission === "denied" ? (
              <p className="mt-3 text-[11px] leading-5 text-[#f4b7aa]">
                This browser blocked notifications. You can change that in its
                site settings later.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <p role="alert" className="rounded-2xl bg-[#fbe5e0] px-4 py-3 text-sm text-coral-strong">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 text-sm font-bold text-white shadow-float transition-colors hover:bg-coral-strong disabled:cursor-wait disabled:bg-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
      >
        {saving ? (
          <>
            <SpinnerGap size={18} className="animate-spin" aria-hidden="true" />
            Saving…
          </>
        ) : (
          <>
            Finish setup
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}
