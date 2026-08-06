"use client";

import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { brand } from "@/config/brand";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-porcelain px-4 py-10">
      <div className="w-full max-w-[420px] rounded-[2rem] bg-white p-7 text-center shadow-card ring-1 ring-black/[0.035]">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-[#fbe5e0] text-coral-strong">
          <WarningCircle size={28} weight="fill" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-4xl leading-none tracking-[-0.035em]">
          Something went wrong.
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          Nothing you saved has been lost. Try again, and if it keeps happening
          let us know at{" "}
          <a
            href={`mailto:${brand.supportEmail}`}
            className="font-semibold text-ink hover:underline"
          >
            {brand.supportEmail}
          </a>
          .
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-2xl bg-coral px-5 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            <ArrowClockwise size={16} weight="bold" aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/today"
            className="inline-flex items-center rounded-2xl bg-porcelain px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            Go to Today
          </Link>
        </div>
      </div>
    </main>
  );
}
