"use client";

import { Check, Copy, Export, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  availableContactShareFields,
  contactShareFieldLabels,
  defaultContactShareSelection,
  type ContactShareField,
  type ContactShareSelection,
} from "@/lib/contact-card";
import { getApiResponseError, readJsonResponse } from "@/lib/http";
import {
  buildShareUrl,
  shareIsLive,
  type PersonShare,
} from "@/lib/person-share";
import type { Person } from "@/lib/types";

const sensitiveFields = new Set<ContactShareField>([
  "phoneNumber",
  "email",
  "notes",
]);

type SharesResponse = { available?: boolean; shares?: PersonShare[] };
type CreateResponse = { available?: boolean; share?: PersonShare };

export function SharePersonButton({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<ContactShareSelection>(
    defaultContactShareSelection,
  );
  // Null while we are still finding out. Links stay hidden until we know the
  // table exists, so a deploy that lands before migration 0015 simply shows the
  // contact card, exactly as before.
  const [linksAvailable, setLinksAvailable] = useState<boolean | null>(null);
  const [shares, setShares] = useState<PersonShare[]>([]);
  const [creating, setCreating] = useState(false);
  const canShareLink = typeof navigator !== "undefined" && Boolean(navigator.share);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(() => availableContactShareFields(person), [person]);
  const liveShares = useMemo(
    () => shares.filter((share) => shareIsLive(share)),
    [shares],
  );

  const loadShares = useCallback(async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      setLinksAvailable(false);
      return;
    }

    try {
      const response = await fetch(
        `/api/person-shares?personId=${encodeURIComponent(person.id)}`,
      );
      const payload = await readJsonResponse<SharesResponse>(response);
      if (!response.ok || !payload?.available) {
        setLinksAvailable(false);
        return;
      }
      setLinksAvailable(true);
      setShares(payload.shares ?? []);
    } catch {
      setLinksAvailable(false);
    }
  }, [person.id]);

  // Escape closes it, the way every other dialog on the page does.
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void loadShares();
  }, [open, loadShares]);

  function toggle(field: ContactShareField) {
    setSelection((current) => ({ ...current, [field]: !current[field] }));
  }

  function shareUrlFor(share: PersonShare) {
    return buildShareUrl(window.location.origin, share.token);
  }



  /** The live link if there is one, otherwise a fresh one. Never a second. */
  async function ensureLink() {
    return liveShares[0] ?? (await createLink());
  }

  async function copyShareLink() {
    const share = await ensureLink();
    if (share) await copyLink(share);
  }

  async function sendShareLink() {
    const share = await ensureLink();
    if (share) await shareLink(share);
  }

  async function createLink() {
    if (creating) return null;
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/person-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person.id, selection }),
      });
      const payload = await readJsonResponse<CreateResponse>(response);

      if (!response.ok) {
        setError(await getApiResponseError(response, "That link couldn't be created."));
        return null;
      }
      if (!payload?.available || !payload.share) {
        // The table isn't there yet. Nothing broke; the card still works.
        setLinksAvailable(false);
        return null;
      }

      setShares((current) => [payload.share!, ...current]);
      return payload.share;
    } catch {
      setError("That link couldn't be created. Check your connection.");
      return null;
    } finally {
      setCreating(false);
    }
  }

  async function copyLink(share: PersonShare) {
    try {
      await navigator.clipboard.writeText(shareUrlFor(share));
      setCopiedToken(share.token);
      window.setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      setError("Copying didn't work. Select the link and copy it by hand.");
    }
  }

  async function shareLink(share: PersonShare) {
    const url = shareUrlFor(share);
    if (navigator.share) {
      try {
        await navigator.share({ url, title: person.fullName });
        return;
      } catch {
        // Dismissed; fall back to the clipboard.
      }
    }
    await copyLink(share);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelection(defaultContactShareSelection);
          setError(null);
          setOpen(true);
        }}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-porcelain px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        <Export size={17} weight="bold" aria-hidden="true" />
        Share
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            // A click inside the sheet must not reach the backdrop behind it.
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Share ${person.fullName}`}
            className="max-h-[88vh] w-full max-w-[420px] overflow-y-auto rounded-[1.75rem] bg-white p-5 shadow-float"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-2xl leading-tight">
                  Share {person.preferredName || person.fullName}
                </h2>
                <p className="mt-1 text-xs leading-5 text-ink-muted">
                  Choose what goes on the card. Everything else stays with you.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid size-8 shrink-0 place-items-center rounded-full bg-porcelain text-ink hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <X size={16} weight="bold" aria-hidden="true" />
              </button>
            </div>

            <ul className="mt-4 grid gap-1.5">
              {fields.map((field) => (
                <li key={field}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selection[field]}
                    onClick={() => toggle(field)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-porcelain px-3.5 py-3 text-left hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-md ${
                        selection[field]
                          ? "bg-coral text-white"
                          : "bg-white text-transparent"
                      }`}
                    >
                      <Check size={12} weight="bold" aria-hidden="true" />
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">
                        {contactShareFieldLabels[field]}
                      </span>
                      {sensitiveFields.has(field) ? (
                        <span className="block text-[11px] text-ink-muted">
                          Off by default
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => void copyShareLink()}
              disabled={creating}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-coral-strong disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
            >
              {copiedToken ? (
                <Check size={17} weight="bold" aria-hidden="true" />
              ) : (
                <Copy size={17} weight="bold" aria-hidden="true" />
              )}
              {copiedToken ? "Link copied" : creating ? "Making a link…" : "Copy link"}
            </button>

            {canShareLink ? (
              <button
                type="button"
                onClick={() => void sendShareLink()}
                className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-porcelain px-5 text-sm font-semibold text-ink transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <Export size={16} weight="bold" aria-hidden="true" />
                Share link
              </button>
            ) : null}

            {error ? (
              <p className="mt-3 text-center text-xs leading-5 text-coral-strong">{error}</p>
            ) : null}

            {!linksAvailable ? (
              <p className="mt-3 text-center text-[11px] leading-4 text-ink-muted">
                Links are not available on this account yet.
              </p>
            ) : null}

            {liveShares.length > 0 ? (
              <p className="mt-3 break-all text-center text-[11px] leading-4 text-ink-muted">
                {shareUrlFor(liveShares[0])}
              </p>
            ) : null}

          </div>
        </div>
      ) : null}
    </>
  );
}
