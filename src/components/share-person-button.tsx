"use client";

import { Check, ShareNetwork, X } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import {
  availableContactShareFields,
  buildVCard,
  contactCardFileName,
  contactShareFieldLabels,
  defaultContactShareSelection,
  type ContactShareField,
  type ContactShareSelection,
} from "@/lib/contact-card";
import type { Person } from "@/lib/types";

const sensitiveFields = new Set<ContactShareField>([
  "phoneNumber",
  "email",
  "notes",
]);

export function SharePersonButton({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<ContactShareSelection>(
    defaultContactShareSelection,
  );

  const fields = useMemo(() => availableContactShareFields(person), [person]);

  function toggle(field: ContactShareField) {
    setSelection((current) => ({ ...current, [field]: !current[field] }));
  }

  async function share() {
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

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelection(defaultContactShareSelection);
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
            className="w-full max-w-[420px] rounded-[1.75rem] bg-white p-5 shadow-float"
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
              onClick={() => void share()}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
            >
              <ShareNetwork size={17} weight="bold" aria-hidden="true" />
              Share contact card
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
