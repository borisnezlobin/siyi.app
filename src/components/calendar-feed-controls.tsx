"use client";

import {
  AppleLogo,
  ArrowClockwise,
  ArrowSquareOut,
  Check,
  Copy,
  GoogleLogo,
  SpinnerGap,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand";
import {
  googleSubscribeUrl,
  httpsFeedUrl,
  webcalFeedUrl,
} from "@/lib/calendar-feed";
import { getApiResponseError } from "@/lib/http";

export function CalendarFeedControls({
  initialToken,
}: {
  initialToken: string | null;
}) {
  const [token, setToken] = useState(initialToken);
  const [origin, setOrigin] = useState("");
  const [working, setWorking] = useState<"on" | "reset" | "off" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  async function writeToken(action: "on" | "reset") {
    setWorking(action);
    setError("");
    const response = await fetch("/api/calendar", { method: "POST" });
    if (!response.ok) {
      setError(
        await getApiResponseError(response, "The link could not be made."),
      );
      setWorking(null);
      return;
    }
    const { token: fresh } = (await response.json()) as { token: string };
    setToken(fresh);
    setCopied(false);
    setWorking(null);
  }

  async function turnOff() {
    setWorking("off");
    setError("");
    const response = await fetch("/api/calendar", { method: "DELETE" });
    if (!response.ok) {
      setError(
        await getApiResponseError(response, "The link could not be turned off."),
      );
      setWorking(null);
      return;
    }
    setToken(null);
    setWorking(null);
  }

  async function copyLink() {
    if (!token) return;
    await navigator.clipboard.writeText(httpsFeedUrl(token, origin));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  if (!token) {
    return (
      <div>
        <p className="text-xs leading-5 text-ink-muted">
          {brand.shortName} can hand your calendar a private link. Birthdays and
          reminders then show up next to everything else you have on, and stay
          in step on their own.
        </p>
        <button
          type="button"
          onClick={() => void writeToken("on")}
          disabled={working !== null}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#28332e] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          {working === "on" ? (
            <SpinnerGap size={14} className="animate-spin" aria-hidden="true" />
          ) : null}
          Create my calendar link
        </button>
        {error ? (
          <p role="alert" className="mt-3 text-xs leading-5 text-coral-strong">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs leading-5 text-ink-muted">
        Add it once and your calendar keeps itself up to date. Anyone with this
        link can read your birthdays and reminders, so keep it to yourself.
      </p>

      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <a
          href={googleSubscribeUrl(token, origin)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-ink shadow-card transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          <GoogleLogo size={15} weight="bold" aria-hidden="true" />
          Add to Google Calendar
          <ArrowSquareOut size={13} aria-hidden="true" />
        </a>
        <a
          href={webcalFeedUrl(token, origin)}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-ink shadow-card transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          <AppleLogo size={15} weight="fill" aria-hidden="true" />
          Add to Apple Calendar
        </a>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-ink/[0.04] px-3 py-2.5">
        <code className="min-w-0 flex-1 truncate text-[11px] text-ink-muted">
          {httpsFeedUrl(token, origin)}
        </code>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 text-[11px] font-semibold text-ink shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          {copied ? (
            <Check size={13} weight="bold" aria-hidden="true" />
          ) : (
            <Copy size={13} aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-ink-muted">
        Outlook and anything else that takes a calendar link will accept this
        one too.
      </p>

      <div className="mt-4 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => void writeToken("reset")}
          disabled={working !== null}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink hover:text-coral-strong disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          {working === "reset" ? (
            <SpinnerGap size={13} className="animate-spin" aria-hidden="true" />
          ) : (
            <ArrowClockwise size={13} aria-hidden="true" />
          )}
          Reset the link
        </button>
        <button
          type="button"
          onClick={() => void turnOff()}
          disabled={working !== null}
          className="text-xs font-semibold text-ink-muted hover:text-coral-strong disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          Turn it off
        </button>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-ink-muted">
        Both stop the calendars already subscribed to this link. Resetting gives
        you a new one to hand out.
      </p>

      {error ? (
        <p role="alert" className="mt-3 text-xs leading-5 text-coral-strong">
          {error}
        </p>
      ) : null}
    </div>
  );
}
