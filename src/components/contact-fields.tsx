"use client";

import { formatPhoneNumberInput } from "@/lib/phone-format";
import { normalizeInstagramUsername } from "@/lib/instagram";

const inputClassName =
  "mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";
const labelClassName = "block text-xs font-semibold text-ink-muted";

export type ContactFieldValues = {
  phoneNumber: string;
  email: string;
  instagramUsername: string;
};

export function emptyContactFieldValues(): ContactFieldValues {
  return { phoneNumber: "", email: "", instagramUsername: "" };
}

/**
 * Every way of reaching one person, in one place. Kept separate from the rest
 * of the form so it can grow into several phones, emails and handles without
 * touching anything else.
 */
export function ContactFields({
  defaults,
  onChange,
}: {
  defaults: ContactFieldValues;
  onChange?: (values: Partial<ContactFieldValues>) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className={labelClassName}>
        Phone
        <input
          name="phoneNumber"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="(555) 555-0123"
          defaultValue={formatPhoneNumberInput(defaults.phoneNumber)}
          onChange={(event) => {
            event.currentTarget.value = formatPhoneNumberInput(
              event.currentTarget.value,
            );
            onChange?.({ phoneNumber: event.currentTarget.value });
          }}
          className={inputClassName}
        />
      </label>
      <label className={labelClassName}>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="jordan@example.edu"
          defaultValue={defaults.email}
          onChange={(event) => onChange?.({ email: event.currentTarget.value })}
          className={inputClassName}
        />
      </label>
      <label className={`${labelClassName} sm:col-span-2`}>
        Instagram
        <input
          name="instagramUsername"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="@username or profile link"
          defaultValue={defaults.instagramUsername}
          onChange={(event) =>
            onChange?.({ instagramUsername: event.currentTarget.value })
          }
          onBlur={(event) => {
            const normalized = normalizeInstagramUsername(
              event.currentTarget.value,
            );
            event.currentTarget.value = normalized;
            onChange?.({ instagramUsername: normalized });
          }}
          className={inputClassName}
        />
      </label>
    </div>
  );
}
