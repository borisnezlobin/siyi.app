import { ArrowRight, Heart, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { brand } from "@/config/brand";

/**
 * The chrome every marketing page outside the home page wears. The home page
 * keeps its own header because its hero starts flush against it, but the links
 * and the footer are the same, and a content page that quietly lost the footer
 * would lose the internal links a crawler follows to the rest of the site.
 */
export function MarketingShell({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow: string;
  title: string;
  lede: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-porcelain text-ink">
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
          href="/auth?method=password&mode=signup"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-semibold shadow-card transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          Get started
          <ArrowRight size={15} weight="bold" aria-hidden="true" />
        </Link>
      </header>

      <article className="mx-auto max-w-[760px] px-5 pb-16 pt-6 sm:px-8 sm:pb-24">
        <p className="text-sm font-semibold text-sage-strong">{eyebrow}</p>
        <h1 className="mt-3 text-balance font-display text-[2.6rem] leading-[0.98] tracking-[-0.04em] sm:text-[3.4rem]">
          {title}
        </h1>
        <p className="mt-6 text-lg leading-8 text-ink-muted">{lede}</p>
        {children}

        <div className="mt-14 rounded-[1.5rem] bg-white p-7 text-center shadow-card">
          <p className="font-display text-3xl tracking-[-0.03em]">
            Start with one person.
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-ink-muted">
            {brand.name} is free, and the whole first step is writing one
            sentence about someone you met this week.
          </p>
          <Link
            href="/auth?method=password&mode=signup"
            className="mt-6 inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-coral px-7 py-3.5 text-sm font-bold text-white shadow-float transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            Try {brand.shortName}
            <ArrowRight size={18} weight="bold" aria-hidden="true" />
          </Link>
        </div>
      </article>

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
        <nav aria-label="More from Siyi" className="flex flex-wrap gap-5">
          <Link className="hover:text-ink" href="/faq">
            FAQ
          </Link>
          <Link className="hover:text-ink" href="/reviews">
            Reviews
          </Link>
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

/** A titled block of prose. Content pages are almost entirely made of these. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-[1.9rem] leading-tight tracking-[-0.03em]">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-8 text-ink-muted">
        {children}
      </div>
    </section>
  );
}
