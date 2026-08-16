import { AppleLogo, EnvelopeSimple } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import {
  sendMagicLink,
  sendPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from "@/app/auth/actions";
import {
  AuthProviderButton,
  AuthSecondaryButton,
  AuthSubmitButton,
} from "@/components/auth-submit-button";
import { brand } from "@/config/brand";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata: Metadata = publicPageMetadata("auth");

const fieldClasses =
  "mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20";

const labelClasses = "block text-xs font-semibold text-ink-muted";

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
    error?: string;
    error_code?: string;
    method?: string;
    mode?: string;
    reason?: string;
  }>;
}) {
  const parameters = await searchParams;
  // Password is the way in unless the emailed link is asked for, so the two are
  // never on screen together and the link never faces a password field.
  const usingPassword = parameters.method !== "link";
  const signupMode = usingPassword && parameters.mode === "signup";
  const isExpired =
    parameters.error_code === "otp_expired" ||
    parameters.error?.toLowerCase().includes("expired");

  const error = isExpired
    ? "That link has expired. Magic links are short-lived, so request a new one."
    : parameters.error;
  // A one-line status under a still-filled form read as a failure. When
  // something has been sent, the sent state is the whole screen.
  if (parameters.sent && !error) {
    const linkKind =
      parameters.reason === "confirm"
        ? "confirmation"
        : parameters.reason === "reset"
          ? "password-reset"
          : "sign-in";
    const nextStep =
      parameters.reason === "confirm"
        ? `Open it to confirm your account and finish setting up ${brand.shortName}.`
        : parameters.reason === "reset"
          ? "Open it to choose a new password."
          : "Open it and you are signed in. No password needed.";

    return (
      <main className="flex min-h-screen items-center bg-porcelain px-5 py-10">
        <div className="mx-auto w-full max-w-[520px]">
          <div className="rounded-3xl bg-white p-8 text-center shadow-card">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-ink text-white">
              <EnvelopeSimple size={26} weight="bold" aria-hidden="true" />
            </span>
            <h1 className="mt-5 font-display text-[2.25rem] leading-[1] tracking-[-0.03em]">
              Check your email
            </h1>
            <p className="mt-3 text-sm leading-6 text-ink-muted">
              Your {linkKind} link is on its way to{" "}
              <span className="font-semibold text-ink">{parameters.sent}</span>.{" "}
              {nextStep}
            </p>
            <p className="mt-4 text-xs leading-5 text-ink-muted">
              It usually lands within a minute. If it has not shown up, have a
              look in your spam folder.
            </p>
          </div>
          <Link
            href="/auth"
            className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold text-ink transition-colors hover:bg-ink/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center bg-porcelain px-5 py-10">
      <div className="mx-auto w-full max-w-[520px] space-y-6">
        <h1 className="font-display text-[2.75rem] leading-[0.95] tracking-[-0.04em]">
          Remember the people who matter.
        </h1>

        {usingPassword ? (
          <nav className="flex gap-6" aria-label="Sign in or create an account">
            {(
              [
                ["Sign in", "/auth"],
                ["Create account", "/auth?mode=signup"],
              ] as const
            ).map(([label, href]) => {
              const selected = (label === "Create account") === signupMode;
              return (
                <Link
                  key={label}
                  href={href}
                  aria-current={selected ? "page" : undefined}
                  className={`border-b-2 pb-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
                    selected
                      ? "border-ink text-ink"
                      : "border-transparent text-ink-muted"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        ) : (
          <p className="text-sm leading-6 text-ink-muted">
            Enter your email and we&apos;ll send a link that signs you in. No
            password needed.
          </p>
        )}

        <form
          action={
            usingPassword
              ? signupMode
                ? signUpWithPassword
                : signInWithPassword
              : sendMagicLink
          }
          className="space-y-4"
        >
          {signupMode ? (
            <label className={labelClasses}>
              Your name
              <input
                name="displayName"
                type="text"
                required
                autoComplete="name"
                placeholder="What should we call you?"
                className={fieldClasses}
              />
            </label>
          ) : null}

          <label className={labelClasses}>
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className={fieldClasses}
            />
          </label>

          {usingPassword ? (
            <label className={labelClasses}>
              Password
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={72}
                autoComplete={signupMode ? "new-password" : "current-password"}
                placeholder="At least 8 characters"
                className={fieldClasses}
              />
            </label>
          ) : null}

          {signupMode ? (
            <label className="flex items-start gap-2.5 text-xs leading-5 text-ink-muted">
              <input
                name="marketingOptIn"
                type="checkbox"
                className="mt-0.5 size-4 shrink-0 accent-coral"
              />
              <span>
                Email me occasional news about {brand.shortName}. We only send
                things worth reading, and very rarely.
              </span>
            </label>
          ) : null}

          <AuthSubmitButton
            label={
              usingPassword
                ? signupMode
                  ? "Create account"
                  : "Sign in"
                : "Email me a sign-in link"
            }
            pendingLabel={
              usingPassword
                ? signupMode
                  ? "Creating your account…"
                  : "Signing you in…"
                : "Sending your link…"
            }
          />

          {usingPassword && !signupMode ? (
            // Same form, same email: forgetting a password should not mean
            // typing the address again on a separate screen.
            <AuthSecondaryButton
              formAction={sendPasswordReset}
              label="Forgot your password?"
            />
          ) : null}
        </form>

        {error ? (
          <p role="alert" className="text-xs leading-5 text-coral-strong">
            {error}
          </p>
        ) : null}

        <div className="space-y-2.5">
          <button
            type="button"
            disabled
            className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-mist px-5 text-sm font-semibold text-ink opacity-50"
          >
            <AppleLogo size={19} weight="fill" aria-hidden="true" />
            Continue with Apple
          </button>
          <form action={signInWithGoogle}>
            <AuthProviderButton
              provider="google"
              label="Continue with Google"
              pendingLabel="Opening Google…"
            />
          </form>
          <p className="text-center text-xs text-ink-muted">
            Apple sign-in is coming soon.
          </p>
        </div>

        <Link
          href={usingPassword ? "/auth?method=link" : "/auth"}
          className="flex h-12 w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold text-ink transition-colors hover:bg-ink/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          {usingPassword ? "Email me a sign-in link" : "Use my password instead"}
        </Link>

        <p className="text-center text-xs leading-5 text-ink-muted">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="font-semibold text-sage-strong hover:underline">
            Terms
          </Link>{" "}
          and acknowledge our{" "}
          <Link href="/privacy" className="font-semibold text-sage-strong hover:underline">
            Privacy policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
