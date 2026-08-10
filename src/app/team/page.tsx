import {
  ArrowLeft,
  ArrowUpRight,
  GitPullRequest,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { publicPageMetadata } from "@/lib/public-pages";

export const metadata: Metadata = publicPageMetadata("team");

const repositoryUrl = "https://github.com/borisnezlobin/siyi.app";

export default function TeamPage() {
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
          <UsersThree aria-hidden="true" className="text-sage-strong" size={23} />
          <h1 className="mt-5 font-display text-5xl tracking-[-0.04em]">
            Team {brand.shortName}
          </h1>
          <p className="mt-5 text-base leading-8 text-ink-muted">
            {brand.name} is built by a small group of college students in
            Berkeley. We made it because we kept meeting people we liked and
            then losing track of them, and nothing we tried was worth the
            effort of keeping up.
          </p>
          <p className="mt-4 text-base leading-8 text-ink-muted">
            It is still early, and the work happens in the open. If you want to
            help build it, or you have an idea for something it should do, the
            repository is the place for both — open a pull request if you have
            written the thing, or an issue if you would rather just say it.
          </p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href={repositoryUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-coral px-5 py-3.5 text-sm font-bold text-white shadow-float transition-colors hover:bg-coral-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
            >
              <GitPullRequest size={17} weight="bold" aria-hidden="true" />
              See the code
              <ArrowUpRight size={15} weight="bold" aria-hidden="true" />
            </a>
            <a
              href={`${repositoryUrl}/issues/new`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-porcelain px-5 py-3.5 text-sm font-semibold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            >
              Suggest a feature
              <ArrowUpRight size={15} weight="bold" aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
