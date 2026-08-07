import type { Metadata } from "next";
import Link from "next/link";
import { brand } from "@/config/brand";
import { buildVCard, contactCardFileName } from "@/lib/contact-card";
import { sharedFieldRows } from "@/lib/person-share";
import {
  recordShareView,
  resolveSharedPerson,
} from "@/lib/person-share-server";
import { SaveActions } from "./save-actions";

export const dynamic = "force-dynamic";

/**
 * A shared card is somebody's contact details. It should never turn up in a
 * search result, so the page is noindex here and disallowed in robots.txt.
 */
export const metadata: Metadata = {
  title: "Shared contact",
  robots: { index: false, follow: false, nocache: true },
};

function expiryNote(expiresAt: string | null) {
  if (!expiresAt) return "This link stays open until it is turned off.";
  const when = new Date(expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `This link stops working on ${when}.`;
}

/**
 * One page for every way a link can fail — unknown, expired, revoked, archived,
 * deleted. Telling them apart would confirm that a guessed token was once real.
 */
function UnavailableLink() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[560px] flex-col justify-center px-6 py-16">
      <h1 className="font-display text-4xl leading-none tracking-[-0.035em] text-ink">
        This link isn&apos;t available.
      </h1>
      <p className="mt-4 text-sm leading-6 text-ink-muted">
        Shared cards expire, and whoever sent it can turn it off whenever they
        like. Ask them for a fresh link and it&apos;ll work again.
      </p>
      <p className="mt-10 border-t border-black/[0.07] pt-6 text-xs leading-5 text-ink-muted">
        <Link href="/" className="font-semibold text-ink hover:underline">
          {brand.name}
        </Link>{" "}
        is a private place to remember the people in your life.
      </p>
    </main>
  );
}

export default async function SharedPersonPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await resolveSharedPerson(token);

  if (!shared) return <UnavailableLink />;

  void recordShareView(shared.shareId, shared.viewCount);

  const { person, selection } = shared;
  const rows = sharedFieldRows(person, selection);
  const displayName =
    (selection.preferredName && person.preferredName) || person.fullName;

  return (
    <main className="mx-auto flex min-h-screen max-w-[560px] flex-col px-6 py-14 sm:py-20">
      <p className="text-xs font-semibold text-ink-muted">
        Shared contact
      </p>
      <h1 className="mt-3 font-display text-5xl leading-[0.95] tracking-[-0.04em] text-ink">
        {person.fullName}
      </h1>

      {rows.length > 0 ? (
        <dl className="mt-10">
          {rows.map((row, index) => (
            <div
              key={`${row.field}-${index}`}
              className="flex flex-col gap-1 border-t border-black/[0.07] py-4 sm:flex-row sm:items-baseline sm:gap-6"
            >
              <dt className="text-xs font-semibold text-ink-muted sm:w-32 sm:shrink-0">
                {row.label}
              </dt>
              <dd className="whitespace-pre-line text-[15px] leading-6 text-ink">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-8 text-sm leading-6 text-ink-muted">
          Just a name this time — that&apos;s all that was shared.
        </p>
      )}

      <div className="mt-10 border-t border-black/[0.07] pt-8">
        <SaveActions
          card={buildVCard(person, selection)}
          fileName={contactCardFileName(person)}
          personName={displayName}
          token={token}
        />
        <p className="mt-4 text-xs leading-5 text-ink-muted">
          {expiryNote(shared.expiresAt)}
        </p>
      </div>

      <p className="mt-auto pt-12 text-xs leading-5 text-ink-muted">
        Sent with{" "}
        <Link href="/" className="font-semibold text-ink hover:underline">
          {brand.name}
        </Link>
        , a private place to remember the people in your life.
      </p>
    </main>
  );
}
