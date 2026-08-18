import { ArrowRight, Heart, UsersThree } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CaptureDemo } from "@/components/marketing/capture-demo";
import { YearOfKnowing } from "@/components/marketing/year-of-knowing";
import { brand } from "@/config/brand";
import { getAuthenticatedUser } from "@/lib/auth";
import { publicPageMetadata } from "@/lib/public-pages";
import {
  JsonLd,
  organizationSchema,
  softwareApplicationSchema,
  webPageSchema,
  websiteSchema,
} from "@/lib/structured-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = publicPageMetadata("home");

export default async function HomePage() {
  if (isSupabaseConfigured()) {
    const user = await getAuthenticatedUser();
    if (user) redirect("/today");
  }

  return (
    <main className="min-h-screen bg-porcelain text-ink">
      <JsonLd
        schemas={[
          organizationSchema(),
          websiteSchema(),
          softwareApplicationSchema(),
          webPageSchema("home"),
        ]}
      />
      <header className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <Link
          href="/"
          className="inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          <span className="grid size-10 place-items-center rounded-full bg-coral text-white shadow-card">
            <UsersThree size={20} weight="fill" aria-hidden="true" />
          </span>
          <span className="font-display text-2xl">{brand.name}</span>
        </Link>
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-semibold shadow-card transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          Sign in
          <ArrowRight size={15} weight="bold" aria-hidden="true" />
        </Link>
      </header>

      <section className="mx-auto max-w-[1180px] px-5 pb-16 pt-4 sm:px-8 sm:pb-24 sm:pt-6">
        <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-end lg:gap-16">
          {/* Balanced rather than hard-broken: the same three <br /> tags that
              sat right at 1440 wrapped raggedly on a phone. */}
          <h1 className="text-balance font-display text-[2.9rem] leading-[0.95] tracking-[-0.045em] sm:text-[4rem] lg:text-[4.4rem]">
            Stay close to the people you just met.
          </h1>
          <div className="lg:pb-3">
            <p className="max-w-lg text-lg leading-8 text-ink-muted">
              Write one sentence the day you meet someone, and{" "}
              {brand.shortName} takes it from there — the birthday, the favor
              you promised, the friend you haven’t spoken to since October. It
              brings each of them up when it matters, so you don’t have to
              remember to go looking.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth?method=password&mode=signup"
                className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-coral px-6 py-3.5 text-sm font-bold text-white shadow-float transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
              >
                Start with one person
                <ArrowRight size={18} weight="bold" aria-hidden="true" />
              </Link>
              <Link
                href="/auth"
                className="inline-flex min-h-13 items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-ink shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                I already have an account
              </Link>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-[560px] sm:mt-14">
          <CaptureDemo />
        </div>
      </section>

      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-[1180px] gap-6 px-5 py-14 sm:px-8 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
          <h2 className="font-display text-[2.4rem] leading-[0.95] tracking-[-0.03em] sm:text-5xl">
            Private, and quiet about it.
          </h2>
          <p className="text-base leading-8 text-white/70">
            There is no feed in {brand.shortName}. Nothing you write is ranked,
            scored, or shown to anyone, and the people you add are never told
            they are in here. It is your notebook: export the whole thing
            whenever you like, or delete every line of it, on any day you feel
            like it.
          </p>
        </div>
      </section>

      <YearOfKnowing />

      <section className="bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-20 text-center sm:px-8 sm:py-24">
          <h2 className="mx-auto max-w-3xl font-display text-[2.6rem] leading-[0.95] tracking-[-0.04em] sm:text-6xl">
            You already did the hard part.
            <br />
            You met them.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-8 text-ink-muted">
            Everything after that is keeping track, which a phone is genuinely
            good at. Start with the last person you met and see how little it
            takes.
          </p>
          <Link
            href="/auth?method=password&mode=signup"
            className="mt-8 inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-coral px-7 py-3.5 text-sm font-bold text-white shadow-float transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            Start with one person
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1180px] flex-col gap-4 px-5 py-8 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span className="inline-flex items-center gap-1.5">
          Made with
          <Heart size={13} weight="fill" className="text-coral" aria-hidden="true" />
          <span className="sr-only">love</span>
          by
          <Link className="font-semibold hover:text-ink" href="/team">
            team {brand.shortName}
          </Link>
        </span>
        <nav aria-label="Legal and support" className="flex gap-5">
          <Link className="hover:text-ink" href="/support">
            Support
          </Link>
          <Link className="hover:text-ink" href="/privacy">
            Privacy
          </Link>
          <Link className="hover:text-ink" href="/terms">
            Terms
          </Link>
        </nav>
      </footer>
    </main>
  );
}
