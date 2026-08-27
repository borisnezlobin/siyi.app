import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { formatHandle, parseProfileSlug } from "@/lib/handles";
import { ownCardFields, ownCardLabels, normalizeOwnCard } from "@/lib/own-card";
import { resolvePublicProfile } from "@/lib/public-profile-server";

export const dynamic = "force-dynamic";

/**
 * Someone's own page. Nothing is on it that they did not switch on, and it is
 * kept out of search results: an address you can hand out is not the same as one
 * you want indexed.
 */
export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false, nocache: true },
};

function Unavailable() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[560px] flex-col justify-center px-6 py-16">
      <h1 className="font-display text-4xl leading-none tracking-[-0.035em] text-ink">
        No profile here
      </h1>
      <p className="mt-4 text-sm leading-6 text-ink-muted">
        This address does not belong to anyone, or its owner has turned their
        page off.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-12 w-fit items-center rounded-2xl bg-ink px-6 text-sm font-semibold text-white"
      >
        Go to {brand.name}
      </Link>
    </main>
  );
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const parsed = parseProfileSlug(decodeURIComponent(slug));
  if (!parsed) return <Unavailable />;

  const profile = await resolvePublicProfile(parsed.handle, parsed.tag);
  if (!profile) return <Unavailable />;

  const card = normalizeOwnCard(profile.card);
  const shown = ownCardFields.filter(
    (field) => profile.publicFields[field] && card[field],
  );
  const displayName =
    (profile.publicFields.preferredName && card.preferredName) ||
    (profile.publicFields.fullName && card.fullName) ||
    formatHandle(profile.handle, profile.tag);

  return (
    <main className="mx-auto flex min-h-screen max-w-[560px] flex-col px-6 py-16">
      <p className="text-xs font-semibold text-ink-muted">
        {formatHandle(profile.handle, profile.tag)}
      </p>
      <h1 className="mt-2 font-display text-4xl leading-none tracking-[-0.035em] text-ink">
        {displayName}
      </h1>

      {shown.length > 0 ? (
        <dl className="mt-8 space-y-3 border-t border-black/[0.07] pt-8">
          {shown.map((field) => (
            <div key={field} className="sm:flex sm:gap-4">
              <dt className="text-xs font-semibold text-ink-muted sm:w-32 sm:shrink-0">
                {ownCardLabels[field]}
              </dt>
              <dd className="mt-0.5 min-w-0 break-words text-sm text-ink sm:mt-0">
                {card[field]}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-8 text-sm leading-6 text-ink-muted">
          They have not put anything on their page yet.
        </p>
      )}

      <p className="mt-auto pt-12 text-xs leading-5 text-ink-muted">
        A page on{" "}
        <Link href="/" className="font-semibold text-ink hover:underline">
          {brand.name}
        </Link>
        , a private place to remember the people in your life.{" "}
        <Link
          href="/support"
          className="font-semibold text-ink hover:underline"
        >
          Report this page
        </Link>{" "}
        if it is impersonating someone or should not be here.
      </p>
    </main>
  );
}
