import {
  ArrowRight,
  BellSimple,
  Clock,
  NotePencil,
  Plus,
  ShieldCheck,
  Sparkle,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { brand } from "@/config/brand";
import { getAuthenticatedUser } from "@/lib/auth";
import { publicPageMetadata } from "@/lib/public-pages";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = publicPageMetadata("home");

const previewPeople = [
  {
    initials: "MC",
    name: "Amelia Chen",
    context: "Design club · Coffee 19 days ago",
    note: "Ask how the campus thrift map is going.",
    color: "bg-sage text-sage-strong",
  },
  {
    initials: "LO",
    name: "Luis Ortega",
    context: "Econ 201 · Ready for a hello",
    note: "Spring radio lineup launches soon.",
    color: "bg-[#dce6f2] text-[#284f70]",
  },
  {
    initials: "AO",
    name: "Amara Okafor",
    context: "Campus garden · Met yesterday",
    note: "Share the volunteer group chat.",
    color: "bg-[#f4dfc3] text-[#75401f]",
  },
];

export default async function HomePage() {
  if (isSupabaseConfigured()) {
    const user = await getAuthenticatedUser();
    if (user) redirect("/today");
  }

  return (
    <main className="min-h-screen overflow-hidden bg-porcelain text-ink">
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
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-semibold shadow-card ring-1 ring-black/[0.035] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          Sign in
          <ArrowRight size={15} weight="bold" aria-hidden="true" />
        </Link>
      </header>

      <section className="mx-auto grid max-w-[1180px] items-center gap-12 px-5 pb-16 pt-10 sm:px-8 sm:pb-24 sm:pt-16 lg:grid-cols-[0.92fr_1.08fr] lg:gap-16 lg:pt-20">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-sage px-3 py-2 text-xs font-semibold text-sage-strong">
            <Sparkle size={14} weight="fill" aria-hidden="true" />
            Built for the people behind your college years
          </p>
          <h1 className="mt-7 max-w-2xl font-display text-[3.8rem] leading-[0.88] tracking-[-0.055em] sm:text-7xl lg:text-[5.4rem]">
            Remember more than a name.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-ink-muted sm:text-lg">
            Save the person, the context, and the little details while they are
            fresh. We’ll bring them back to mind when reconnecting could feel
            natural.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth?method=password&mode=signup"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-coral px-6 py-3.5 text-sm font-bold text-white shadow-float transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
            >
              Start your circle
              <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </Link>
            <Link
              href="/auth"
              className="inline-flex min-h-13 items-center justify-center rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-ink shadow-card ring-1 ring-black/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              I already have an account
            </Link>
          </div>
          <div className="mt-7 flex items-center gap-2 text-xs leading-5 text-ink-muted">
            <ShieldCheck
              size={17}
              weight="fill"
              className="shrink-0 text-sage-strong"
              aria-hidden="true"
            />
            Private by default. Every account can only access its own people.
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[570px]">
          <div
            className="absolute -right-24 -top-20 size-56 rounded-full bg-coral/10"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-16 -left-20 size-44 rounded-full bg-sage"
            aria-hidden="true"
          />
          <div className="relative rotate-[1.5deg] rounded-[2.4rem] bg-ink p-4 text-white shadow-float sm:p-6">
            <div className="flex items-center justify-between px-1">
              <div>
                <p className="text-[11px] font-semibold text-sun">Today’s circle</p>
                <h2 className="mt-1 font-display text-3xl tracking-[-0.03em]">
                  Who’s on your mind?
                </h2>
              </div>
              <span className="grid size-11 place-items-center rounded-full bg-white/10">
                <BellSimple size={20} aria-hidden="true" />
              </span>
            </div>

            <div className="mt-6 space-y-3">
              {previewPeople.map((person) => (
                <article
                  key={person.name}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.35rem] bg-white p-3 text-ink"
                >
                  <span
                    className={`grid size-12 place-items-center rounded-full text-xs font-bold ${person.color}`}
                  >
                    {person.initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {person.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] text-ink-muted">
                      {person.context}
                    </span>
                    <span className="mt-1.5 block truncate text-[11px] text-ink/72">
                      {person.note}
                    </span>
                  </span>
                  <span className="grid size-10 place-items-center rounded-full bg-sage text-sage-strong">
                    <Plus size={18} weight="bold" aria-hidden="true" />
                  </span>
                </article>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/8 px-4 py-3">
              <span className="flex items-center gap-2 text-[11px] text-white/68">
                <Clock size={15} aria-hidden="true" />
                A calm list, not a score
              </span>
              <span className="rounded-full bg-coral px-3 py-1.5 text-[10px] font-semibold">
                Add someone
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-[1080px] gap-4 px-5 py-10 sm:grid-cols-3 sm:px-8 sm:py-14">
          {[
            {
              icon: Plus,
              title: "Capture them in seconds",
              copy: "Name, username, where you met, and one useful note. Fill in the rest later.",
            },
            {
              icon: NotePencil,
              title: "Keep the real context",
              copy: "Remember what you talked about, what matters to them, and what you meant to follow up on.",
            },
            {
              icon: BellSimple,
              title: "Reconnect without pressure",
              copy: "Gentle reminders surface people and birthdays without streaks, scores, or guilt.",
            },
          ].map(({ icon: Icon, title, copy }) => (
            <article key={title} className="rounded-[1.5rem] bg-porcelain p-5">
              <span className="grid size-10 place-items-center rounded-full bg-sage text-sage-strong">
                <Icon size={19} weight="fill" aria-hidden="true" />
              </span>
              <h2 className="mt-4 text-sm font-bold">{title}</h2>
              <p className="mt-2 text-xs leading-6 text-ink-muted">{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <footer className="mx-auto flex max-w-[1080px] flex-col gap-4 px-5 py-8 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>{brand.name} · Your people, remembered</span>
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
