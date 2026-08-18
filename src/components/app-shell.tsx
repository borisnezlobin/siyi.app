"use client";

import {
  Bell,
  BellSimple,
  GearSix,
  House,
  Plus,
  UsersThree,
} from "@phosphor-icons/react";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  QuickCaptureHub,
  QuickCaptureTrigger,
} from "@/components/quick-capture-hub";
import { AnnouncementBanner } from "@/components/announcement-banner";
import { NavItemContents } from "@/components/nav-item";
import { recoveryAttemptKey } from "@/components/error-recovery";
import { FoundPhotoHost } from "@/components/found-photo-host";
import { brand } from "@/config/brand";
import { InstallPrompt } from "@/components/install-prompt";

/**
 * These deliberately do NOT set `prefetch`.
 *
 * Every page here is force-dynamic, so `prefetch` fetches the whole finished
 * render rather than stopping at the loading skeleton. Four tabs meant four
 * complete server renders — around thirty Supabase round trips — starting in
 * the background of every page view and competing with the tap the reader
 * actually made. Worse, a fully prefetched payload is reusable for
 * `staleTimes.static`, so tapping People could show a list up to three minutes
 * old: the "recently added" that was never recent.
 *
 * The default prefetches as far as `(app)/loading.tsx` and no further. That is
 * cheap, it cannot go stale, and it means a tap paints a skeleton immediately
 * instead of sitting still. A skeleton that arrives at once beats correct data
 * that arrives late, and both beat stale data.
 */
const primaryNavigation = [
  { href: "/today", label: "Today", icon: House },
  { href: "/people", label: "People", icon: UsersThree },
  { href: "/reminders", label: "Reminders", icon: Bell },
] as const;

const secondaryNavigation = [
  { href: "/notifications", label: "Notifications", icon: BellSimple },
  { href: "/settings", label: "Settings", icon: GearSix },
] as const;

function isCurrentPath(pathname: string, href: string) {
  return href === "/people"
    ? pathname === href || (pathname.startsWith("/people/") && pathname !== "/people/new")
    : pathname === href;
}

export function AppShell({
  children,
  displayName = "Alex Vale",
  email = "alex@example.edu",
}: {
  children: React.ReactNode;
  displayName?: string;
  email?: string;
}) {
  const pathname = usePathname();
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);

  // The shell rendering at all means this browser is on a build that works, so
  // the next time one does not, it is allowed to reload its way out once more.
  useEffect(() => {
    try {
      window.sessionStorage.removeItem(recoveryAttemptKey);
    } catch {
      // Private browsing can refuse storage outright; nothing here needs it.
    }
  }, []);
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-porcelain">
      <InstallPrompt />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-ink px-5 py-6 text-white lg:flex">
        <Link
          href="/today"
          className="flex items-center gap-3 rounded-lg px-2 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
        >
          <span className="grid size-10 place-items-center rounded-full bg-coral text-white shadow-float">
            <UsersThree size={21} weight="fill" aria-hidden="true" />
          </span>
          <span>
            <span className="block font-display text-xl leading-none">
              {brand.name}
            </span>
            <span className="mt-1 block text-[11px] text-white/55">
              {brand.sidebarTagline}
            </span>
          </span>
        </Link>

        <nav className="mt-10 space-y-1" aria-label="Primary navigation">
          {primaryNavigation.map(({ href, label, icon: Icon }) => {
            const active = isCurrentPath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3.5 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun",
                  active
                    ? "bg-white text-ink"
                    : "text-white/68 hover:bg-white/8 hover:text-white active:bg-white/12",
                )}
                aria-current={active ? "page" : undefined}
              >
                <NavItemContents
                  icon={Icon}
                  label={label}
                  active={active}
                  size={20}
                />
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 space-y-2">
          <Link
            href="/people/new"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-coral px-4 py-3 text-sm font-semibold text-white shadow-float transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
          >
            <Plus size={18} weight="bold" aria-hidden="true" />
            Add someone
          </Link>
          <QuickCaptureTrigger
            mode="interaction"
            label="Log interaction"
            surface="sidebar"
          />
          <QuickCaptureTrigger
            mode="update"
            label="Add update"
            surface="sidebar"
          />
          <QuickCaptureTrigger
            mode="reminder"
            label="Reminder"
            surface="sidebar"
          />
        </div>

        <nav className="mt-auto space-y-1" aria-label="Account navigation">
          {secondaryNavigation.map(({ href, label, icon: Icon }) => {
            const active = isCurrentPath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-3.5 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun",
                  active
                    ? "bg-white text-ink"
                    : "text-white/68 hover:bg-white/8 hover:text-white active:bg-white/12",
                )}
                aria-current={active ? "page" : undefined}
              >
                <NavItemContents
                  icon={Icon}
                  label={label}
                  active={active}
                  size={19}
                />
              </Link>
            );
          })}
        </nav>
        <div className="mt-5 flex items-center gap-3 px-2">
          <span className="grid size-9 place-items-center rounded-full bg-sage text-xs font-semibold text-sage-strong">
            {initials}
          </span>
          <span>
            <span className="block text-sm font-medium">{displayName}</span>
            <span className="block max-w-[155px] truncate text-[11px] text-white/50">
              {email}
            </span>
          </span>
        </div>
      </aside>

      <main className="min-h-screen pb-[calc(5.75rem+env(safe-area-inset-bottom))] lg:ml-[248px] lg:pb-0">
        <AnnouncementBanner />
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 items-end bg-white px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-14px_40px_-24px_rgba(23,32,28,0.45)] lg:hidden"
        aria-label="Main navigation"
      >
        {[primaryNavigation[0], primaryNavigation[1]].map(
          ({ href, label, icon: Icon }) => {
            const active = isCurrentPath(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium transition-[background-color,transform] duration-100 active:scale-[0.94] active:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                  active ? "text-ink" : "text-ink-muted",
                )}
                aria-current={active ? "page" : undefined}
              >
                <NavItemContents
                  icon={Icon}
                  label={label}
                  active={active}
                  size={22}
                />
              </Link>
            );
          },
        )}

        <button
          type="button"
          onClick={() => setQuickCaptureOpen((open) => !open)}
          className="relative z-50 -mt-7 flex min-h-16 flex-col items-center justify-end gap-1 text-[10px] font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          aria-label={
            quickCaptureOpen ? "Close quick actions" : "Open quick actions"
          }
          aria-expanded={quickCaptureOpen}
        >
          <span className="grid size-14 place-items-center rounded-full bg-coral text-white shadow-float ring-4 ring-white">
            <Plus
              size={24}
              weight="bold"
              className={clsx(
                "transition-transform duration-200",
                quickCaptureOpen && "rotate-45",
              )}
              aria-hidden="true"
            />
          </span>
          {quickCaptureOpen ? "Close" : "Add"}
        </button>

        {[
          primaryNavigation[2],
          { href: "/settings", label: "Settings", icon: GearSix },
        ].map(({ href, label, icon: Icon }) => {
          const active = isCurrentPath(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-medium transition-[background-color,transform] duration-100 active:scale-[0.94] active:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral",
                active ? "text-ink" : "text-ink-muted",
              )}
              aria-current={active ? "page" : undefined}
            >
              <NavItemContents
                icon={Icon}
                label={label}
                active={active}
                size={22}
              />
            </Link>
          );
        })}
      </nav>
      <QuickCaptureHub
        menuOpen={quickCaptureOpen}
        onMenuOpenChange={setQuickCaptureOpen}
      />
      {/* Outside the page, so an offer outlives the navigation that starts it. */}
      <FoundPhotoHost />
    </div>
  );
}
