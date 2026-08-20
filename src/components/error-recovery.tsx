"use client";

import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { brand } from "@/config/brand";

/**
 * A browser running one build of the app against a newer one on the server.
 * The document names chunks by content hash, so the ones it asks for are simply
 * gone. Nothing rendered can fix this — only throwing the old copy away can —
 * so it is the one error worth recognising by name.
 */
function isStaleBuildError(error: Error) {
  // Deliberately narrow. A bare "failed to fetch" would match here too, and
  // that is what an ordinary dropped connection says — treating it as a stale
  // build would wipe the cache and reload, fail to reach the network again, and
  // do it all over: a reload loop triggered by nothing worse than a tunnel.
  return (
    error.name === "ChunkLoadError" ||
    /loading chunk|loading css chunk|dynamically imported module|module script failed/i.test(
      error.message,
    )
  );
}

/**
 * Whether this is the installed app rather than a browser tab. Wrapped, because
 * everything in this file runs inside the last error boundary there is: a
 * browser without `matchMedia` would otherwise throw while rendering the screen
 * that exists to survive a throw.
 */
function isStandalone() {
  try {
    return (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true
    );
  } catch {
    return false;
  }
}

/** Survives the reload, which is the whole point: it is what stops a second one. */
export const recoveryAttemptKey = "siyi.stale-build-recovered";

async function discardCachedApp() {
  try {
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    }
  } catch {
    // Reloading is worth trying even if the clean-up was refused.
  }
  // The worker itself is left registered. Unregistering would also drop the
  // push subscription this browser is signed up with, and a chunk that will not
  // load is a problem with what the worker stored, not with the worker.
}

/**
 * Recovery that can actually recover.
 *
 * `reset()` alone re-renders the same failed payload, so a deterministic error
 * redraws the same screen and the button reads as broken. Every control here
 * either refetches from the server or leaves the page entirely, shows that it
 * is working while it does, and — because the PWA opens on /today — never
 * relies on a soft navigation to the address the reader is already at.
 */
export function ErrorRecovery({
  error,
  reset,
  title = "Something went wrong.",
  // Inside the signed-in shell the nav is still there and still works, so the
  // screen is a card in the page rather than a replacement for it.
  standalone = true,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  title?: string;
  standalone?: boolean;
}) {
  const router = useRouter();
  const [isRefreshing, startRefreshing] = useTransition();
  const [isLeaving, setIsLeaving] = useState(false);
  // Reloading is only an answer the first time. If the app comes back up on the
  // same broken build the fault is not the stored copy, and reloading again
  // would be a loop with no way out of it, so the second failure gets the
  // ordinary screen and its buttons.
  // Reached through try/catch because this is the boundary of last resort:
  // Safari in private browsing throws on the sessionStorage getter itself, and
  // a throw here means the reader gets Next's own unstyled error page instead
  // of this one.
  const [alreadyRecovered] = useState(() => {
    try {
      return window.sessionStorage.getItem(recoveryAttemptKey) === "true";
    } catch {
      return false;
    }
  });
  const staleBuild = isStaleBuildError(error) && !alreadyRecovered;

  useEffect(() => {
    console.error("[siyi] render failed", {
      name: error.name,
      message: error.message,
      digest: error.digest,
      stack: error.stack,
    });

    /**
     * And sent somewhere it can actually be read. A console on a phone in a
     * home screen app is not somewhere anybody can look, so a failure there
     * used to leave no trace at all — the server logged nothing, because the
     * server was never the thing that broke.
     *
     * `build` is the point of it: the browser says which build it is running,
     * and the reply comes from whichever build is current. Those disagreeing is
     * the difference between "this app is stale" and "this app is broken", and
     * guessing between the two is what has made this hard to pin down.
     */
    void fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        name: error.name,
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        at: typeof window === "undefined" ? null : window.location.pathname,
        build: process.env.NEXT_PUBLIC_BUILD_ID ?? null,
        standalone: isStandalone(),
      }),
    }).catch(() => {
      // A report that cannot be sent is not worth a second error screen.
    });
  }, [error]);

  useEffect(() => {
    if (!staleBuild) return;
    // Serving an old build against a new one is not something to ask about:
    // drop the stored copy and come back on the current one.
    let cancelled = false;
    try {
      window.sessionStorage.setItem(recoveryAttemptKey, "true");
    } catch {
      // Without somewhere to remember the attempt the reload is still worth
      // making; it just cannot be capped at one.
    }
    void discardCachedApp().then(() => {
      if (!cancelled) window.location.reload();
    });
    return () => {
      cancelled = true;
    };
  }, [staleBuild]);

  function tryAgain() {
    startRefreshing(() => {
      // Refresh refetches the server render; reset re-renders the boundary with
      // what came back. Reset on its own would replay the failure.
      router.refresh();
      reset?.();
    });
  }

  function goToToday() {
    setIsLeaving(true);
    // A hard navigation, because /today is usually the address that just
    // failed and a soft one to the current route is a no-op.
    window.location.assign("/today");
  }

  const busy = isRefreshing || isLeaving || staleBuild;

  const Frame = standalone ? "main" : "div";

  return (
    <Frame
      className={
        standalone
          ? "flex min-h-screen items-center justify-center bg-porcelain px-4 py-10"
          : "flex items-center justify-center px-4 py-12"
      }
    >
      <div className="w-full max-w-[420px] rounded-[2rem] bg-white p-7 text-center shadow-card ring-1 ring-black/[0.035]">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#fbe5e0] text-coral-strong">
          <WarningCircle size={28} weight="fill" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-4xl leading-none tracking-[-0.035em]">
          {staleBuild ? "Updating the app." : title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          {staleBuild ? (
            <>A newer version is ready. Getting it now — this takes a moment.</>
          ) : (
            <>
              Nothing you saved has been lost. Try again, and if it keeps
              happening let us know at{" "}
              <a
                href={`mailto:${brand.supportEmail}`}
                className="font-semibold text-ink hover:underline"
              >
                {brand.supportEmail}
              </a>
              .
            </>
          )}
        </p>
        {staleBuild ? null : (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={tryAgain}
              disabled={busy}
              aria-busy={isRefreshing}
              className="inline-flex items-center gap-2 rounded-2xl bg-coral px-5 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-coral-strong active:bg-coral-strong disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
            >
              <ArrowClockwise
                size={16}
                weight="bold"
                aria-hidden="true"
                className={isRefreshing ? "animate-spin" : undefined}
              />
              {isRefreshing ? "Trying…" : "Try again"}
            </button>
            <button
              type="button"
              onClick={goToToday}
              disabled={busy}
              aria-busy={isLeaving}
              className="inline-flex items-center rounded-2xl bg-porcelain px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-mist active:bg-mist disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              {isLeaving ? "Opening…" : "Go to Today"}
            </button>
          </div>
        )}
        {error.digest ? (
          <p className="mt-5 text-[11px] text-ink-muted">
            Reference {error.digest}
          </p>
        ) : null}
      </div>
    </Frame>
  );
}
