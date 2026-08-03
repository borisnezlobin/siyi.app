import {
  ArrowRight,
  EnvelopeSimple,
  GoogleLogo,
  ShieldCheck,
  UsersThree,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { sendMagicLink, signInWithGoogle } from "@/app/auth/actions";

export const metadata: Metadata = {
  title: "Sign in",
};

function AuthVisual() {
  const people = [
    { initials: "MC", name: "Maya", note: "Ceramics studio hours", color: "bg-sage" },
    { initials: "LO", name: "Luis", note: "Spring radio lineup", color: "bg-[#dce6f2]" },
    { initials: "AO", name: "Amara", note: "Campus garden chat", color: "bg-[#f4dfc3]" },
  ];

  return (
    <div className="relative hidden min-h-[720px] overflow-hidden rounded-[2.5rem] bg-ink p-9 text-white shadow-float lg:flex lg:flex-col">
      <div className="relative z-10">
        <p className="flex items-center gap-2 text-xs font-semibold text-sun">
          <UsersThree size={16} weight="fill" aria-hidden="true" />
          The people behind your college years
        </p>
        <h2 className="mt-5 max-w-md font-display text-6xl leading-[0.92] tracking-[-0.045em]">
          Remember the person, not just the name.
        </h2>
        <p className="mt-5 max-w-sm text-sm leading-7 text-white/58">
          Capture context in seconds, then let gentle reminders bring the right
          people back to mind.
        </p>
      </div>

      <div className="relative mt-auto h-72">
        <div className="absolute bottom-0 left-3 right-14 rotate-[-3deg] rounded-[2rem] bg-white/8 p-4">
          <p className="text-xs font-semibold text-white/55">Keep in touch</p>
          <div className="mt-3 space-y-2">
            {people.map((person) => (
              <div
                key={person.name}
                className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 text-ink"
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center rounded-full ${person.color} text-[10px] font-bold`}
                >
                  {person.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold">{person.name}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-ink-muted">
                    {person.note}
                  </span>
                </span>
                <span className="grid size-8 place-items-center rounded-full bg-coral text-white">
                  <ArrowRight size={14} weight="bold" aria-hidden="true" />
                </span>
              </div>
            ))}
          </div>
        </div>
        <div
          className="absolute -bottom-20 -right-24 size-72 rounded-full bg-coral/15"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
    error?: string;
    error_code?: string;
  }>;
}) {
  const parameters = await searchParams;
  const isExpired =
    parameters.error_code === "otp_expired" ||
    parameters.error?.toLowerCase().includes("expired");

  return (
    <main className="min-h-screen bg-porcelain px-4 py-5 sm:px-7 sm:py-8">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1180px] gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <AuthVisual />

        <div className="flex items-center justify-center">
          <div className="w-full max-w-[460px]">
            <Link
              href="/"
              className="mb-9 inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              <span className="grid size-10 place-items-center rounded-full bg-coral text-white shadow-card">
                <UsersThree size={20} weight="fill" aria-hidden="true" />
              </span>
              <span className="font-display text-2xl">{brand.name}</span>
            </Link>

            <section className="rounded-[2rem] bg-white p-5 shadow-card ring-1 ring-black/[0.035] sm:p-8">
              {parameters.sent ? (
                <div className="text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-full bg-sage text-sage-strong">
                    <EnvelopeSimple size={26} weight="fill" aria-hidden="true" />
                  </span>
                  <h1 className="mt-5 font-display text-4xl leading-none tracking-[-0.035em]">
                    Check your inbox
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-ink-muted">
                    We sent a sign-in link to{" "}
                    <strong className="font-semibold text-ink">
                      {parameters.sent}
                    </strong>
                    . It can take a minute to arrive.
                  </p>
                  <Link
                    href="/auth"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
                  >
                    Use another email
                  </Link>
                </div>
              ) : isExpired ? (
                <div className="text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#fbe5e0] text-coral-strong">
                    <WarningCircle size={28} weight="fill" aria-hidden="true" />
                  </span>
                  <h1 className="mt-5 font-display text-4xl leading-none tracking-[-0.035em]">
                    That link has expired
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-ink-muted">
                    Magic links are short-lived for security. Request a new one
                    to continue.
                  </p>
                  <Link
                    href="/auth"
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-coral px-4 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
                  >
                    Request a new link
                  </Link>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold text-coral-strong">
                    Welcome back
                  </p>
                  <h1 className="mt-2 font-display text-4xl leading-none tracking-[-0.035em] sm:text-5xl">
                    Pick up where you left off.
                  </h1>
                  <p className="mt-4 text-sm leading-6 text-ink-muted">
                    Sign in without a password. Your people and notes stay private
                    to your account.
                  </p>

                  {parameters.error ? (
                    <p
                      role="alert"
                      className="mt-5 flex gap-2 rounded-2xl bg-[#fbe5e0] p-3 text-xs leading-5 text-coral-strong"
                    >
                      <WarningCircle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                      {parameters.error}
                    </p>
                  ) : null}

                  <form action={signInWithGoogle} className="mt-7">
                    <button
                      type="submit"
                      className="flex h-13 w-full items-center justify-center gap-3 rounded-2xl bg-ink px-5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-[#28332e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
                    >
                      <GoogleLogo size={20} weight="bold" aria-hidden="true" />
                      Continue with Google
                    </button>
                  </form>

                  <div className="my-5 flex items-center gap-3 text-[11px] text-ink/35">
                    <span className="h-px flex-1 bg-ink/10" />
                    or use your email
                    <span className="h-px flex-1 bg-ink/10" />
                  </div>

                  <form action={sendMagicLink}>
                    <label className="block text-xs font-semibold text-ink-muted">
                      Email address
                      <input
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="you@example.edu"
                        className="mt-1.5 h-12 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-ink/35 focus:border-coral focus:ring-2 focus:ring-coral/20"
                      />
                    </label>
                    <button
                      type="submit"
                      className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-coral px-5 text-sm font-semibold text-white shadow-card transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
                    >
                      Email me a sign-in link
                      <ArrowRight size={17} weight="bold" aria-hidden="true" />
                    </button>
                  </form>

                  <div className="mt-5 flex items-start gap-2 text-[11px] leading-5 text-ink-muted">
                    <ShieldCheck size={16} className="mt-0.5 shrink-0 text-sage-strong" aria-hidden="true" />
                    <p>
                      No password to remember. Each sign-in link works once and
                      expires automatically.
                    </p>
                  </div>
                </>
              )}
            </section>

            <p className="mt-5 text-center text-[11px] leading-5 text-ink-muted">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="font-semibold text-ink hover:underline">
                terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-semibold text-ink hover:underline">
                privacy notice
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
