"use client";

import {
  ArrowLeft,
  CheckCircle,
  Megaphone,
  PaperPlaneTilt,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { getApiResponseError } from "@/lib/http";
import type { AdminStats } from "@/lib/admin-data";
import type { Announcement } from "@/lib/types";

export type AdminSegmentSummary = {
  id: string;
  label: string;
  description: string;
  users: number;
};

type ComposeStep = "writing" | "confirming";

function newDedupeKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `announcement-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function peopleLabel(count: number) {
  return count === 1 ? "1 person" : `${count} people`;
}

function StatCard({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-2xl bg-paper px-5 py-4 shadow-card">
      <p className="text-xs font-semibold text-ink-muted">
        {label}
      </p>
      <p className="mt-2 font-display text-3xl leading-none text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function DistributionBar({
  label,
  users,
  total,
}: {
  label: string;
  users: number;
  total: number;
}) {
  const share = total === 0 ? 0 : Math.round((users / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-medium text-ink-muted">{label}</span>
      <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-mist">
        <span
          className="block h-full rounded-full bg-sage-strong"
          style={{ width: `${share}%` }}
        />
      </span>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-ink">
        {users}
      </span>
    </div>
  );
}

export function AdminDashboard({
  stats,
  segments,
  initialAnnouncements,
  statsError,
}: {
  stats: AdminStats;
  segments: AdminSegmentSummary[];
  initialAnnouncements: Announcement[];
  statsError: string | null;
}) {
  const [announcements, setAnnouncements] = useState(initialAnnouncements);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [segmentId, setSegmentId] = useState(segments[0]?.id ?? "all");
  const [endsAt, setEndsAt] = useState("");
  const [step, setStep] = useState<ComposeStep>("writing");
  const [dedupeKey, setDedupeKey] = useState(newDedupeKey);
  const [publishing, setPublishing] = useState(false);
  const [pushingId, setPushingId] = useState<string | null>(null);
  const [pushConfirmId, setPushConfirmId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedSegment = useMemo(
    () => segments.find((segment) => segment.id === segmentId) ?? null,
    [segments, segmentId],
  );
  const audience = selectedSegment?.users ?? 0;
  const canReview = title.trim().length > 0 && body.trim().length > 0;
  const busiestWeek = Math.max(1, ...stats.signupsByWeek.map((week) => week.users));

  async function publish() {
    setPublishing(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          segment: segmentId,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          dedupeKey,
        }),
      });

      if (!response.ok) {
        setError(await getApiResponseError(response, "That announcement did not save."));
        return;
      }

      const payload = (await response.json()) as {
        announcement: Announcement | null;
        alreadyCreated: boolean;
      };
      if (payload.announcement) {
        setAnnouncements((current) => [
          payload.announcement as Announcement,
          ...current.filter((item) => item.id !== payload.announcement?.id),
        ]);
      }
      setMessage(
        payload.alreadyCreated
          ? "That announcement was already published, so nothing was sent twice."
          : `Banner is live for ${peopleLabel(audience)}.`,
      );
      setTitle("");
      setBody("");
      setEndsAt("");
      setDedupeKey(newDedupeKey());
      setStep("writing");
    } catch {
      setError("The app server did not respond. Try again.");
    } finally {
      setPublishing(false);
    }
  }

  async function sendPush(announcement: Announcement) {
    setPushingId(announcement.id);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/admin/announcements/${announcement.id}/push`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => null)) as {
        announcement?: Announcement;
        delivered?: number;
        failed?: number;
        recipients?: number;
        error?: string;
      } | null;

      if (payload?.announcement) {
        setAnnouncements((current) =>
          current.map((item) =>
            item.id === announcement.id
              ? (payload.announcement as Announcement)
              : item,
          ),
        );
      }

      if (!response.ok) {
        setError(payload?.error ?? "That push did not go out.");
        return;
      }

      setMessage(
        `Pushed to ${peopleLabel(payload?.recipients ?? 0)}: ${payload?.delivered ?? 0} delivered, ${payload?.failed ?? 0} failed.`,
      );
    } catch {
      setError("The app server did not respond. Try again.");
    } finally {
      setPushingId(null);
      setPushConfirmId(null);
    }
  }

  return (
    <div className="space-y-8">
      {statsError ? (
        <p className="rounded-2xl bg-sun/40 px-4 py-3 text-sm text-ink">
          Stats could not be loaded right now. {statsError}
        </p>
      ) : null}


      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="font-display text-2xl text-ink">
          How Siyi is doing
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Aggregates only. Nobody&apos;s name, email, or contacts appear here.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatCard label="Total users" value={stats.totalUsers} />
          <StatCard
            label="New this week"
            value={stats.newUsersLast7}
            hint={`${stats.newUsersLast30} in the last 30 days`}
          />
          <StatCard
            label="Active this week"
            value={stats.activeLast7}
            hint={`${stats.activeLast30} in the last 30 days`}
          />
          <StatCard label="Push turned on" value={stats.pushEnabledUsers} />
          <StatCard label="Contacts saved" value={stats.totalContacts} />
          <StatCard
            label="Quiet 30 days"
            value={Math.max(0, stats.totalUsers - stats.activeLast30)}
          />
        </div>
      </section>

      <section aria-labelledby="distribution-heading" className="rounded-2xl bg-paper p-5 shadow-card">
        <h2 id="distribution-heading" className="font-display text-xl text-ink">
          Contacts per person
        </h2>
        <div className="mt-4 space-y-2.5">
          {stats.contactBuckets.map((bucket) => (
            <DistributionBar
              key={bucket.id}
              label={bucket.label}
              users={bucket.users}
              total={stats.totalUsers}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="signups-heading" className="rounded-2xl bg-paper p-5 shadow-card">
        <h2 id="signups-heading" className="font-display text-xl text-ink">
          Sign-ups by week
        </h2>
        <div className="mt-4 flex h-28 items-end gap-1.5">
          {stats.signupsByWeek.map((week) => (
            <div key={week.weekStarting} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] tabular-nums text-ink-muted">
                {week.users || ""}
              </span>
              <span
                className="w-full rounded-t-md bg-sage-strong/85"
                style={{ height: `${Math.max(2, (week.users / busiestWeek) * 100)}%` }}
                title={`Week of ${week.weekStarting}: ${week.users}`}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">Last 12 weeks.</p>
      </section>

      <section aria-labelledby="compose-heading" className="rounded-2xl bg-paper p-5 shadow-card">
        <h2 id="compose-heading" className="font-display text-2xl text-ink">
          Send an announcement
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          It shows as a dismissible banner inside the app. Push is a separate,
          deliberate step once the banner exists.
        </p>

        {step === "writing" ? (
          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-ink">Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                className="mt-1.5 w-full rounded-xl border border-mist bg-porcelain px-3.5 py-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-sage-strong"
                placeholder="Reminders now arrive on your phone"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink">Message</span>
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                maxLength={1000}
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-mist bg-porcelain px-3.5 py-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-sage-strong"
                placeholder="Turn on notifications in Settings and we will nudge you at a good hour."
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-ink">Who sees it</span>
                <select
                  value={segmentId}
                  onChange={(event) => setSegmentId(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-mist bg-porcelain px-3.5 py-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-sage-strong"
                >
                  {segments.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.label} ({segment.users})
                    </option>
                  ))}
                </select>
                {selectedSegment ? (
                  <span className="mt-1.5 block text-xs text-ink-muted">
                    {selectedSegment.description}
                  </span>
                ) : null}
              </label>
              <label className="block">
                <span className="text-sm font-medium text-ink">
                  Hide it after (optional)
                </span>
                <input
                  type="date"
                  value={endsAt}
                  onChange={(event) => setEndsAt(event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-mist bg-porcelain px-3.5 py-2.5 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-sage-strong"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={!canReview}
              onClick={() => setStep("confirming")}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <Megaphone size={18} weight="fill" aria-hidden="true" />
              Review before sending
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl bg-porcelain px-4 py-4">
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="mt-1 text-sm leading-6 text-ink-muted">{body}</p>
            </div>
            <p className="text-sm text-ink">
              This banner will appear for{" "}
              <strong className="font-semibold">{peopleLabel(audience)}</strong>{" "}
              in the segment &ldquo;{selectedSegment?.label}&rdquo;
              {endsAt ? ` until ${formatDate(new Date(endsAt).toISOString())}` : ""}.
              No push notification goes out yet.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={publish}
                disabled={publishing}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-coral px-5 py-3 text-sm font-semibold text-white shadow-float transition-colors hover:bg-coral-strong disabled:opacity-60"
              >
                <CheckCircle size={18} weight="fill" aria-hidden="true" />
                {publishing ? "Publishing..." : `Publish to ${peopleLabel(audience)}`}
              </button>
              <button
                type="button"
                onClick={() => setStep("writing")}
                disabled={publishing}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-mist px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-sage"
              >
                <ArrowLeft size={18} aria-hidden="true" />
                Keep editing
              </button>
            </div>
          </div>
        )}

        {message ? (
          <p className="mt-4 rounded-xl bg-sage px-4 py-3 text-sm text-ink">{message}</p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-xl bg-coral/15 px-4 py-3 text-sm text-coral-strong">
            {error}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="font-display text-2xl text-ink">
          What has gone out
        </h2>
        {announcements.length === 0 ? (
          <p className="mt-3 text-sm text-ink-muted">Nothing sent yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {announcements.map((announcement) => {
              const pushed = Boolean(announcement.pushSentAt);
              return (
                <li
                  key={announcement.id}
                  className="rounded-2xl bg-paper p-5 shadow-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {announcement.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-ink-muted">
                        {announcement.body}
                      </p>
                      <p className="mt-2 text-xs text-ink-muted">
                        {announcement.segment} &middot;{" "}
                        {announcement.audienceSize ?? 0} in segment at send time
                        &middot; {formatDate(announcement.createdAt)}
                      </p>
                    </div>
                    {pushed ? (
                      <p className="text-xs text-ink-muted">
                        Pushed {formatDate(announcement.pushSentAt as string)} to{" "}
                        {announcement.pushRecipientCount ?? 0} &middot;{" "}
                        {announcement.pushDeliveredCount ?? 0} delivered,{" "}
                        {announcement.pushFailedCount ?? 0} failed
                      </p>
                    ) : pushConfirmId === announcement.id ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => sendPush(announcement)}
                          disabled={pushingId === announcement.id}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-coral px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-coral-strong disabled:opacity-60"
                        >
                          <PaperPlaneTilt size={16} weight="fill" aria-hidden="true" />
                          {pushingId === announcement.id
                            ? "Sending..."
                            : `Yes, push to ${announcement.audienceSize ?? 0}`}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPushConfirmId(null)}
                          className="inline-flex min-h-11 items-center rounded-xl bg-mist px-4 py-2.5 text-sm font-semibold text-ink"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPushConfirmId(announcement.id)}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-mist px-4 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-sage"
                      >
                        <PaperPlaneTilt size={16} aria-hidden="true" />
                        Send as push
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
