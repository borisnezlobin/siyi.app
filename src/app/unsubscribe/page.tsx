import { ArrowRight, EnvelopeSimple, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: "Unsubscribed",
  robots: { index: false, follow: false },
};

type UnsubscribeStatus = "done" | "invalid" | "error";

const outcomes: Record<
  UnsubscribeStatus,
  { heading: string; body: string; settled: boolean }
> = {
  done: {
    heading: "You're unsubscribed.",
    body: "We won't send you any more updates about new features. Reminders you asked for still come through, and you can turn emails back on in Settings whenever you like.",
    settled: true,
  },
  invalid: {
    heading: "That link didn't work.",
    body: "It may have been broken by your email app, or it may be out of date. You can always turn emails off from Settings.",
    settled: false,
  },
  error: {
    heading: "Something went wrong.",
    body: `We couldn't save that just now. Try the link again in a minute, or email us at ${brand.supportEmail} and we'll take care of it.`,
    settled: false,
  },
};

function resolveOutcome(status: string | undefined) {
  if (status === "done" || status === "error") return outcomes[status];
  return outcomes.invalid;
}

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const outcome = resolveOutcome(status);

  return (
    <main className="flex min-h-screen items-center justify-center bg-porcelain px-4 py-10">
      <div className="w-full max-w-[420px] rounded-[2rem] bg-white p-7 text-center shadow-card ring-1 ring-black/[0.035]">
        <span
          className={`mx-auto grid size-14 place-items-center rounded-full ${
            outcome.settled
              ? "bg-sage text-sage-strong"
              : "bg-[#fbe5e0] text-coral-strong"
          }`}
        >
          {outcome.settled ? (
            <EnvelopeSimple size={26} weight="fill" aria-hidden="true" />
          ) : (
            <WarningCircle size={26} weight="fill" aria-hidden="true" />
          )}
        </span>
        <h1 className="mt-5 font-display text-4xl leading-none tracking-[-0.035em]">
          {outcome.heading}
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">{outcome.body}</p>
        <Link
          href="/settings"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-coral px-5 py-3 text-sm font-semibold text-white shadow-card transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
        >
          Go to Settings
          <ArrowRight size={16} weight="bold" aria-hidden="true" />
        </Link>
        <p className="mt-6 text-[11px] leading-5 text-ink-muted">
          {brand.name} · {brand.postalAddress}
        </p>
      </div>
    </main>
  );
}
