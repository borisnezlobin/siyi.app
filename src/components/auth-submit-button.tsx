"use client";

import { SpinnerGap } from "@phosphor-icons/react";
import { AppleMark, GoogleMark } from "@/components/brand-marks";
import { useFormStatus } from "react-dom";

/**
 * Signing in takes a round trip to the auth service and then a redirect, and
 * the form gave no sign that anything was happening in between — pressing enter
 * looked like it had done nothing, which invites pressing it again.
 *
 * `useFormStatus` reports on whichever action the form is running, so the reset
 * link below it goes quiet at the same time rather than staying pressable.
 */
export function AuthSubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 text-sm font-semibold text-white transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 disabled:bg-coral/70"
    >
      {pending ? (
        <>
          <SpinnerGap size={17} weight="bold" className="animate-spin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

const providerLogos = { google: GoogleMark, apple: AppleMark };

/**
 * Each provider sits in its own single-button form, so its pending state is its
 * own: pressing Google must not grey out Apple beside it.
 *
 * The logo is chosen from a name rather than passed in. A component is a
 * function, and handing one from the server page to this client component is
 * not something React can serialise — it threw at render and took the whole
 * sign-in screen down with it.
 */
export function AuthProviderButton({
  label,
  pendingLabel,
  provider,
}: {
  label: string;
  pendingLabel: string;
  provider: keyof typeof providerLogos;
}) {
  const { pending } = useFormStatus();
  const Icon = providerLogos[provider];

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-mist px-5 text-sm font-semibold text-ink transition-colors hover:bg-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 disabled:opacity-60"
    >
      {pending ? (
        <SpinnerGap size={19} weight="bold" className="animate-spin" aria-hidden="true" />
      ) : (
        <Icon size={19} />
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}

/** The reset link shares the form, so it shares the form's pending state. */
export function AuthSecondaryButton({
  label,
  formAction,
}: {
  label: string;
  formAction: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      formAction={formAction}
      formNoValidate
      disabled={pending}
      className="text-xs font-semibold text-sage-strong underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:opacity-50"
    >
      {label}
    </button>
  );
}
