import { ArrowClockwise, UsersThree } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { brand } from "@/config/brand";

export default function OfflinePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-porcelain px-5 py-12">
      <section className="w-full max-w-md rounded-[2rem] bg-white p-7 text-center shadow-card ring-1 ring-black/[0.035]">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-sage text-sage-strong">
          <UsersThree size={26} weight="fill" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-4xl">You’re offline</h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          {brand.name} needs a connection to load private people and notes. Your
          account data is never cached in the shared app shell.
        </p>
        <Link
          href="/today"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-coral px-4 py-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          <ArrowClockwise size={17} weight="bold" aria-hidden="true" />
          Try again
        </Link>
      </section>
    </main>
  );
}
