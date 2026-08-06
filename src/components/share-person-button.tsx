"use client";

import { Check, Copy, LinkSimple, ShareNetwork, X } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  availableContactShareFields,
  buildVCard,
  contactCardFileName,
  contactShareFieldLabels,
  defaultContactShareSelection,
  type ContactShareField,
  type ContactShareSelection,
} from "@/lib/contact-card";
import { getApiResponseError, readJsonResponse } from "@/lib/http";
import {
  buildShareUrl,
  defaultShareExpiryChoiceId,
  shareExpiryChoices,
  shareIsLive,
  type PersonShare,
  type ShareExpiryChoiceId,
} from "@/lib/person-share";
import type { Person } from "@/lib/types";

const sensitiveFields = new Set<ContactShareField>([
  "phoneNumber",
  "email",
  "notes",
]);

type SharesResponse = { available?: boolean; shares?: PersonShare[] };
type CreateResponse = { available?: boolean; share?: PersonShare };

function expiryLabel(share: PersonShare) {
  if (!share.expiresAt) return "No expiry";
  return `Expires ${new Date(share.expiresAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

export function SharePersonButton({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<ContactShareSelection>(
    defaultContactShareSelection,
  );
  const [expiry, setExpiry] = useState<ShareExpiryChoiceId>(
    defaultShareExpiryChoiceId,
  );
  // Null while we are still finding out. Links stay hidden until we know the
  // table exists, so a deploy that lands before migration 0015 simply shows the
  // contact card, exactly as before.
  const [linksAvailable, setLinksAvailable] = useState<boolean | null>(null);
  const [shares, setShares] = useState<PersonShare[]>([]);
  const [creating, setCreating] = useState(false);
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

  async function shareCard() {
    const card = buildVCard(person, selection);
    const fileName = contactCardFileName(person);
    const file = new File([card], fileName, { type: "text/vcard" });

    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: person.fullName });
        setOpen(false);
        return;
      } catch {
        // The person dismissed the share sheet; fall through to a download.
      }
    }

    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  async function createLink() {
    setCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/person-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personId: person.id, selection, expiry }),
      });
      const payload = await readJsonResponse<CreateResponse>(response);

      if (!response.ok) {
        setError(await getApiResponseError(response, "That link couldn't be created."));
        return;
      }
      if (!payload?.available || !payload.share) {
        // The table isn't there yet. Nothing broke; the card still works.
        setLinksAvailable(false);
        return;
      }

      setShares((current) => [payload.share!, ...current]);
      await copyLink(payload.share);
    } catch {
      setError("That link couldn't be created. Check your connection.");
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

  async function revokeLink(share: PersonShare) {
    setShares((current) => current.filter((entry) => entry.id !== share.id));
    try {
      await fetch(`/api/person-shares/${share.id}`, { method: "DELETE" });
    } catch {
      setError("We couldn't turn that link off. Try again in a moment.");
      void loadShares();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelection(defaultContactShareSelection);
          setExpiry(defaultShareExpiryChoiceId);
          setError(null);
          setOpen(true);
        }}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-porcelain px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        <ShareNetwork size={17} weight="bold" aria-hidden="true" />
        Share
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div
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
              onClick={() => void shareCard()}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
            >
              <ShareNetwork size={17} weight="bold" aria-hidden="true" />
              Share contact card
            </button>

            {linksAvailable ? (
              <div className="mt-6 border-t border-black/[0.07] pt-5">
                <h3 className="text-sm font-semibold text-ink">
                  Or send a link
                </h3>
                <p className="mt-1 text-xs leading-5 text-ink-muted">
                  A page on siyi.app showing only what you ticked above. Anyone
                  with the link can open it, so it expires by default.
                </p>

                <div
                  role="radiogroup"
                  aria-label="How long the link lasts"
                  className="mt-3 flex flex-wrap gap-1.5"
                >
                  {shareExpiryChoices.map((choice) => (
                    <button
                      key={choice.id}
                      type="button"
                      role="radio"
                      aria-checked={expiry === choice.id}
                      onClick={() => setExpiry(choice.id)}
                      className={`h-9 rounded-full px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
                        expiry === choice.id
                          ? "bg-ink text-white"
                          : "bg-porcelain text-ink-muted hover:bg-mist"
                      }`}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void createLink()}
                  disabled={creating}
                  className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-porcelain px-5 text-sm font-semibold text-ink transition-colors hover:bg-mist disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                >
                  <LinkSimple size={16} weight="bold" aria-hidden="true" />
                  {creating ? "Creating link…" : "Create a link"}
                </button>

                {liveShares.length > 0 ? (
                  <ul className="mt-4 grid gap-2">
                    {liveShares.map((share) => (
                      <li
                        key={share.id}
                        className="flex items-center gap-2 rounded-2xl bg-porcelain px-3.5 py-2.5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-ink">
                            /s/{share.token.slice(0, 8)}…
                          </span>
                          <span className="block text-[11px] text-ink-muted">
                            {expiryLabel(share)}
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => void copyLink(share)}
                          aria-label="Copy link"
                          className="grid size-8 place-items-center rounded-full bg-white text-ink hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                        >
                          {copiedToken === share.token ? (
                            <Check size={14} weight="bold" aria-hidden="true" />
                          ) : (
                            <Copy size={14} weight="bold" aria-hidden="true" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => void shareLink(share)}
                          aria-label="Send link"
                          className="grid size-8 place-items-center rounded-full bg-white text-ink hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                        >
                          <ShareNetwork
                            size={14}
                            weight="bold"
                            aria-hidden="true"
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => void revokeLink(share)}
                          className="h-8 rounded-full px-2.5 text-[11px] font-semibold text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                        >
                          Turn off
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {error ? (
                  <p className="mt-3 text-xs leading-5 text-coral-strong">
                    {error}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
