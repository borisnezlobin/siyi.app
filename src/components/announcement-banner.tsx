"use client";

import { Megaphone, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";

type BannerAnnouncement = {
  id: string;
  title: string;
  body: string;
};

const dismissedStorageKey = "siyi:dismissed-announcements";

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = window.localStorage.getItem(dismissedStorageKey);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function rememberDismissed(id: string) {
  if (typeof window === "undefined") return;
  try {
    const next = [...new Set([...readDismissed(), id])].slice(-50);
    window.localStorage.setItem(dismissedStorageKey, JSON.stringify(next));
  } catch {
    // A full or blocked storage is not a reason to break the page.
  }
}

/**
 * Announcements are optional furniture: if the endpoint is unavailable, the
 * table has not been migrated yet, or the user is in no segment, this renders
 * nothing at all.
 */
export function AnnouncementBanner() {
  const [announcement, setAnnouncement] = useState<BannerAnnouncement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/announcements", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          announcements?: BannerAnnouncement[];
        };
        if (cancelled) return;
        const dismissed = readDismissed();
        const next = (payload.announcements ?? []).find(
          (item) => !dismissed.includes(item.id),
        );
        if (!next) return;
        setAnnouncement(next);
        requestAnimationFrame(() => setVisible(true));
      } catch {
        // Silent: the banner is never worth an error state.
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    if (!announcement) return;
    rememberDismissed(announcement.id);
    setVisible(false);
    window.setTimeout(() => setAnnouncement(null), 220);
    void fetch("/api/announcements/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ announcementId: announcement.id }),
    }).catch(() => undefined);
  }, [announcement]);

  if (!announcement) return null;

  return (
    <div
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
        visible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="overflow-hidden">
        <div className="px-4 pt-4 sm:px-7 lg:px-10">
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl bg-sage px-4 py-3.5 text-ink shadow-card"
          >
            <Megaphone
              size={18}
              className="mt-0.5 shrink-0 text-sage-strong"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{announcement.title}</p>
              <p className="mt-1 text-sm leading-6 text-ink-muted">
                {announcement.body}
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss announcement"
              className="-mr-1 grid size-8 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-white/60 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage-strong"
            >
              <X size={16} weight="bold" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
