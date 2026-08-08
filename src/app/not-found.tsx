import { ArrowRight, Compass } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-porcelain px-4 py-10">
      <div className="w-full max-w-[420px] rounded-[2rem] bg-white p-7 text-center shadow-card ring-1 ring-black/[0.035]">
        <Compass size={26} className="mx-auto text-ink-muted" aria-hidden="true" />
        <h1 className="mt-5 font-display text-4xl leading-none tracking-[-0.035em]">
          We can&apos;t find that page.
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          The link may be out of date, or the page may have moved. Your people
          are all still here.
        </p>
        <Link
          href="/today"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-coral px-5 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          Go to Today
          <ArrowRight size={16} weight="bold" aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
