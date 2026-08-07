import { AppleLogo, GoogleLogo } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import {
  sendMagicLink,
  sendPasswordReset,
  signInWithPassword,
  signUpWithPassword,
} from "@/app/auth/actions";

export const metadata: Metadata = {
  title: "Sign in",
};

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
  const message = parameters.sent
    ? `We sent ${
        parameters.reason === "confirm"
          ? "a confirmation"
          : parameters.reason === "reset"
            ? "a password-reset"
            : "a sign-in"
      } link to ${parameters.sent}. It can take a minute to arrive — check your spam folder if it does not show up.`
    : null;

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

          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-coral px-5 text-sm font-semibold text-white transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            {usingPassword
              ? signupMode
                ? "Create account"
                : "Sign in"
              : "Email me a sign-in link"}
          </button>

          {usingPassword && !signupMode ? (
            // Same form, same email: forgetting a password should not mean
            // typing the address again on a separate screen.
            <button
              type="submit"
              formAction={sendPasswordReset}
              formNoValidate
              className="text-xs font-semibold text-sage-strong underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              Forgot your password?
            </button>
          ) : null}
        </form>

        {error ? (
          <p role="alert" className="text-xs leading-5 text-coral-strong">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-xs leading-5 text-sage-strong">
            {message}
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
          <button
            type="button"
            disabled
            className="flex h-12 w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-mist px-5 text-sm font-semibold text-ink opacity-50"
          >
            <GoogleLogo size={19} weight="bold" aria-hidden="true" />
            Continue with Google
          </button>
          <p className="text-center text-xs text-ink-muted">
            Apple and Google sign-in are coming soon.
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
