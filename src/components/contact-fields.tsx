"use client";

import { Plus, Star, X } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import {
  contactFormValues,
  contactMethodKinds,
  emptyContactDrafts,
  maxContactMethodsPerKind,
  normalizeContactMethodValue,
  withPrimaryAt,
  withoutDraftAt,
  type ContactMethodDraft,
  type ContactMethodKind,
} from "@/lib/contact-methods";
import { formatPhoneNumberInput } from "@/lib/phone-format";

const inputClassName =
  "h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";
const labelInputClassName =
  "h-12 w-full rounded-2xl border border-black/10 bg-white px-3 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20 sm:w-32";
const labelClassName = "block text-xs font-semibold text-ink-muted";

type KindPresentation = {
  heading: string;
  noun: string;
  placeholder: string;
  labelPlaceholder: string;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
};

const presentation: Record<ContactMethodKind, KindPresentation> = {
  phone: {
    heading: "Phone",
    noun: "number",
    placeholder: "(555) 555-0123",
    labelPlaceholder: "work",
    inputProps: { type: "tel", autoComplete: "tel", inputMode: "tel" },
  },
  email: {
    heading: "Email",
    noun: "email",
    placeholder: "jordan@example.edu",
    labelPlaceholder: "school",
    inputProps: { type: "email", autoComplete: "email" },
  },
  discord: {
    heading: "Discord",
    noun: "username",
    placeholder: "username",
    labelPlaceholder: "server",
    inputProps: { autoCapitalize: "none", autoCorrect: "off" },
  },
  instagram: {
    heading: "Instagram",
    noun: "handle",
    placeholder: "@username or profile link",
    labelPlaceholder: "finsta",
    inputProps: { autoCapitalize: "none", autoCorrect: "off" },
  },
};

/** A row needs an identity that survives editing, and a brand new row has no
 * database id to borrow one from. */
type ContactRow = ContactMethodDraft & { key: string };

let nextRowKey = 0;
function rowKey() {
  nextRowKey += 1;
  return `contact-row-${nextRowKey}`;
}

function toRows(drafts: ContactMethodDraft[]): ContactRow[] {
  return drafts.map((draft) => ({ ...draft, key: draft.id ?? rowKey() }));
}

/**
 * Every way of reaching one person, in one place: as many numbers, addresses
 * and handles as they actually have, one of each to begin with.
 */
export function ContactFields({
  drafts,
  onChange,
}: {
  drafts?: ContactMethodDraft[];
  onChange?: (drafts: ContactMethodDraft[]) => void;
}) {
  const [rows, setRows] = useState<ContactRow[]>(() =>
    toRows(drafts ?? emptyContactDrafts()),
  );

  function update(next: ContactRow[]) {
    setRows(next);
    onChange?.(next.map(({ key: _key, ...draft }) => draft));
  }

  const formValues = useMemo(
    () => contactFormValues(rows.map(({ key: _key, ...draft }) => draft)),
    [rows],
  );

  return (
    <div className="grid gap-5">
      {contactMethodKinds.map((kind) => {
        const { heading, noun, placeholder, labelPlaceholder, inputProps } =
          presentation[kind];
        const indexesOfKind = rows
          .map((row, index) => ({ row, index }))
          .filter((entry) => entry.row.kind === kind);
        // With a single row there is nothing to label and nothing to choose
        // between, so adding a person stays one box per kind.
        const showRowControls = indexesOfKind.length > 1;

        return (
          <fieldset key={kind} className="min-w-0">
            <legend className={labelClassName}>{heading}</legend>
            <div className="mt-1.5 space-y-2">
              {indexesOfKind.map(({ row, index }, ordinal) => (
                <div
                  key={row.key}
                  className="flex flex-wrap items-center gap-2 sm:flex-nowrap"
                >
                  <input
                    {...inputProps}
                    aria-label={
                      showRowControls ? `${heading} ${ordinal + 1}` : heading
                    }
                    placeholder={placeholder}
                    value={row.value}
                    onChange={(event) => {
                      const value =
                        kind === "phone"
                          ? formatPhoneNumberInput(event.target.value)
                          : event.target.value;
                      update(
                        rows.map((candidate, position) =>
                          position === index
                            ? { ...candidate, value }
                            : candidate,
                        ),
                      );
                    }}
                    onBlur={(event) => {
                      if (kind !== "instagram") return;
                      const value = normalizeContactMethodValue(
                        kind,
                        event.target.value,
                      );
                      update(
                        rows.map((candidate, position) =>
                          position === index
                            ? { ...candidate, value }
                            : candidate,
                        ),
                      );
                    }}
                    className={`${inputClassName} min-w-0 flex-1`}
                  />
                  {showRowControls ? (
                    <>
                      <input
                        aria-label={`Label for this ${noun}`}
                        placeholder={labelPlaceholder}
                        maxLength={40}
                        value={row.label ?? ""}
                        onChange={(event) =>
                          update(
                            rows.map((candidate, position) =>
                              position === index
                                ? { ...candidate, label: event.target.value }
                                : candidate,
                            ),
                          )
                        }
                        className={labelInputClassName}
                      />
                      <button
                        type="button"
                        onClick={() => update(withPrimaryAt(rows, index))}
                        aria-pressed={row.isPrimary}
                        title={
                          row.isPrimary
                            ? `Main ${noun}`
                            : `Make this the main ${noun}`
                        }
                        className={`grid size-12 shrink-0 place-items-center rounded-2xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
                          row.isPrimary
                            ? "bg-sun/25 text-ink"
                            : "bg-porcelain text-ink-muted hover:bg-mist"
                        }`}
                      >
                        <Star
                          size={17}
                          weight={row.isPrimary ? "fill" : "regular"}
                          aria-hidden="true"
                        />
                        <span className="sr-only">
                          {row.isPrimary
                            ? `Main ${noun}`
                            : `Make this the main ${noun}`}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => update(withoutDraftAt(rows, index))}
                        className="grid size-12 shrink-0 place-items-center rounded-2xl bg-porcelain text-ink-muted transition-colors hover:bg-mist hover:text-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                      >
                        <X size={16} aria-hidden="true" />
                        <span className="sr-only">Remove this {noun}</span>
                      </button>
                    </>
                  ) : null}
                </div>
              ))}
            </div>

            {indexesOfKind.length < maxContactMethodsPerKind ? (
              <button
                type="button"
                onClick={() =>
                  update([
                    ...rows,
                    {
                      key: rowKey(),
                      kind,
                      value: "",
                      label: null,
                      isPrimary: false,
                    },
                  ])
                }
                className="mt-2 flex items-center gap-1.5 rounded-xl px-1 py-1 text-xs font-semibold text-coral-strong transition-colors hover:text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <Plus size={13} weight="bold" aria-hidden="true" />
                {indexesOfKind.length === 0
                  ? `Add a ${noun}`
                  : `Add another ${noun}`}
              </button>
            ) : null}
          </fieldset>
        );
      })}

      {/* The primary of each kind keeps its long-standing field name, and the
          full list rides alongside it. */}
      <input type="hidden" name="phoneNumber" value={formValues.phoneNumber} />
      <input type="hidden" name="email" value={formValues.email} />
      <input
        type="hidden"
        name="instagramUsername"
        value={formValues.instagramUsername}
      />
      <input
        type="hidden"
        name="contactMethods"
        value={formValues.contactMethods}
      />
    </div>
  );
}
