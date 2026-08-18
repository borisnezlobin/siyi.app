"use client";

import { SpinnerGap } from "@phosphor-icons/react";
import clsx from "clsx";
import { useFormStatus } from "react-dom";
import { AppleMark, GoogleMark } from "@/components/provider-marks";

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

/**
 * Each provider sits in its own single-button form, so its pending state is its
 * own: pressing Google must not grey out Apple beside it.
 *
 * The provider is named rather than passed as a component. A component is a
 * function, and handing one from the server page to this client component is
 * not something React can serialise — it threw at render and took the whole
 * sign-in screen down with it.
 *
 * Both buttons follow the brand's own rules: Google white with its four-colour
 * mark, Apple black with its own. Google asks for a hairline edge, which is a
 * border on a rounded corner — a ring draws the same line without the corners
 * fraying.
 */
export function AuthProviderButton({
  label,
  pendingLabel,
  provider,
}: {
  label: string;
  pendingLabel: string;
  provider: "google" | "apple";
}) {
  const { pending } = useFormStatus();
  const google = provider === "google";

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={clsx(
        "flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl px-5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2 disabled:opacity-60",
        google
          ? "bg-white text-ink shadow-card ring-1 ring-black/10 hover:bg-porcelain"
          : "bg-black text-white hover:bg-black/85",
      )}
    >
      {pending ? (
        <SpinnerGap size={19} weight="bold" className="animate-spin" aria-hidden="true" />
      ) : google ? (
        <GoogleMark size={18} />
      ) : (
        <AppleMark size={18} />
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
