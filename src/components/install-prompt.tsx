"use client";

import { DotsThreeVertical, Export, House, Plus, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { brand } from "@/config/brand";

type Platform = "ios" | "android" | null;

const dismissedKey = "siyi.install-hint.dismissed";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return null;
  const agent = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(agent)) return "ios";
  if (/Android/i.test(agent)) return "android";
  return null;
}

function isAlreadyInstalled() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari reports installed PWAs here rather than through display-mode.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Most people have never heard the words "progressive web app", so this shows
 * the actual steps for the phone they are holding and never says PWA.
 */
export function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isAlreadyInstalled()) return;
    if (window.localStorage.getItem(dismissedKey) === "true") return;
    const detected = detectPlatform();
    if (!detected) return;
    setPlatform(detected);
    setVisible(true);
  }, []);

  function dismiss() {
    window.localStorage.setItem(dismissedKey, "true");
    setVisible(false);
    setOpen(false);
  }

  if (!visible || !platform) return null;

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center gap-3 bg-ink px-4 py-2.5 text-white lg:hidden">
        <House size={18} weight="fill" className="shrink-0 text-sun" aria-hidden="true" />
        <p className="flex-1 text-[12px] leading-4">
          Add {brand.shortName} to your home screen so it opens like an app.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
        >
          Show me
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded-lg p-1.5 text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun"
        >
          <X size={15} weight="bold" aria-hidden="true" />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/50 p-3 lg:hidden">
          {/* Bounded and scrollable: on a short screen the three steps used to
              push the dismiss button off the bottom with no way back to it. */}
          <div className="max-h-[88dvh] w-full overflow-y-auto rounded-[1.75rem] bg-white p-5 shadow-float">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl leading-tight">
                Put {brand.shortName} on your home screen
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-porcelain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <X size={15} weight="bold" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-ink-muted">
              It opens full screen, works offline, and can send you reminders.
            </p>

            <ol className="mt-4 space-y-3">
              {(platform === "ios"
                ? [
                    { icon: Export, text: "Tap the share button in Safari's toolbar." },
                    { icon: Plus, text: "Scroll down and choose “Add to Home Screen”." },
                    { icon: House, text: "Tap Add. Look for the icon on your home screen." },
                  ]
                : [
                    { icon: DotsThreeVertical, text: "Tap the three dots in Chrome's toolbar." },
                    { icon: Plus, text: "Choose “Add to Home screen”, then Install." },
                    { icon: House, text: "Look for the icon on your home screen." },
                  ]
              ).map((step, index) => (
                <li key={step.text} className="flex items-center gap-3">
                  <step.icon size={17} className="shrink-0 text-ink-muted" aria-hidden="true" />
                  <p className="flex-1 text-xs leading-5">
                    <span className="font-bold">{index + 1}. </span>
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={dismiss}
              className="mt-5 h-11 w-full rounded-2xl bg-porcelain text-xs font-semibold text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              Don&apos;t show this again
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
