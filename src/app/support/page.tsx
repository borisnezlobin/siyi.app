import {
  ArrowLeft,
  EnvelopeSimple,
  Question,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata: Metadata = publicPageMetadata("support");

const helpTopics = [
  {
    title: "A change has not synced yet",
    body: "Keep the app installed and open it again when you have a connection. Saved offline changes are sent in the order you made them.",
  },
  {
    title: "A sign-in link opens in the wrong browser",
    body: "Open the link in the same browser or container where you requested it. You can also use Apple, Google, or your email and password.",
  },
  {
    title: "Notifications are not arriving",
    body: "Open Settings, choose Notifications, and confirm that both the browser or iPhone permission and your reminder categories are enabled.",
  },
];

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-porcelain px-5 py-8 text-ink sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          href="/"
        >
          <ArrowLeft aria-hidden="true" size={17} weight="bold" />
          Back to {brand.name}
        </Link>

        <section className="mt-8 rounded-[1.5rem] bg-white p-6 shadow-card sm:p-9">
          <Question aria-hidden="true" className="text-sage-strong" size={23} />
          <h1 className="mt-5 font-display text-5xl tracking-[-0.04em]">
            How can we help?
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-ink-muted sm:text-base">
            Tell us what happened, what you expected, and which device you
            were using. Please leave out private notes about people you know.
          </p>
          <a
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-coral px-5 py-3 text-sm font-bold text-white shadow-card transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
            href={`mailto:${brand.supportEmail}?subject=${encodeURIComponent(`${brand.name} support`)}`}
          >
            <EnvelopeSimple aria-hidden="true" size={19} weight="bold" />
            Email {brand.supportEmail}
          </a>
        </section>

        <section className="mt-5 grid gap-3">
          {helpTopics.map((topic) => (
            <article
              className="rounded-2xl bg-white p-5 shadow-card"
              key={topic.title}
            >
              <h2 className="text-sm font-bold">{topic.title}</h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                {topic.body}
              </p>
            </article>
          ))}
        </section>

        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-sage p-5 text-sage-strong">
          <ShieldCheck
            aria-hidden="true"
            className="mt-0.5 shrink-0"
            size={21}
            weight="duotone"
          />
          <p className="text-sm leading-6">
            Account deletion is available directly in Settings. You can also
            review our{" "}
            <Link className="font-bold underline" href="/privacy">
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link className="font-bold underline" href="/terms">
              Terms
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
