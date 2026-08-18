import { Info, Star } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { brand } from "@/config/brand";
import { publicPageMetadata } from "@/lib/public-pages";
import {
  aggregateRating,
  getPublishedReviews,
  type PublishedReview,
} from "@/lib/reviews";
import {
  breadcrumbSchema,
  JsonLd,
  reviewsSchema,
  webPageSchema,
} from "@/lib/structured-data";

export const metadata: Metadata = publicPageMetadata("reviews");

// Reviews are published by hand, so this page does not need to be dynamic, but
// it must not be baked at build time either — a review published on Tuesday
// should not wait for a deploy.
export const revalidate = 600;

function Rating({ value }: { value: number }) {
  return (
    <p
      className="flex gap-0.5 text-coral"
      aria-label={`${value} out of 5`}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((position) => (
        <Star
          key={position}
          size={16}
          weight={position <= value ? "fill" : "regular"}
          aria-hidden="true"
          className={position <= value ? undefined : "text-ink-muted/40"}
        />
      ))}
    </p>
  );
}

function ReviewCard({ review }: { review: PublishedReview }) {
  return (
    <li className="rounded-[1.25rem] bg-white p-6 shadow-card">
      <Rating value={review.rating} />
      <blockquote className="mt-4 text-base leading-8 text-ink">
        {review.body}
      </blockquote>
      <p className="mt-4 text-sm font-semibold text-ink-muted">
        {review.authorLabel}
      </p>
    </li>
  );
}

export default async function ReviewsPage() {
  const reviews = await getPublishedReviews();
  const aggregate = aggregateRating(reviews);

  return (
    <>
      <JsonLd
        schemas={[
          webPageSchema("reviews"),
          breadcrumbSchema([
            { name: brand.name, path: "/" },
            { name: "Reviews", path: "/reviews" },
          ]),
          // Only marked up once there is something real to mark up.
          ...(reviews.length ? [reviewsSchema(reviews, aggregate)] : []),
        ]}
      />
      <MarketingShell
        eyebrow="Reviews"
        title={`What people say about ${brand.shortName}`}
        lede={`Reviews written by people with a ${brand.name} account, published here by the team that makes it.`}
      >
        {/* Above the fold and unmissable on purpose. A page called "reviews"
            run by the company whose product is being reviewed has to say so
            before anyone reads a word of it, not in a footer disclosure. */}
        <aside className="mt-10 flex gap-3 rounded-[1.25rem] bg-sage p-5 text-sm leading-7 text-ink">
          <Info size={20} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0 text-sage-strong" />
          <p>
            <strong className="font-semibold">
              This page is run by the {brand.shortName} team.
            </strong>{" "}
            It is not an independent review site. Every review below was written
            by someone with a {brand.name} account, published as they wrote it.
            We do not pay for reviews, we do not offer anything in exchange for a
            good one, and we do not take a review down because it is critical.
          </p>
        </aside>

        {reviews.length === 0 ? (
          <section className="mt-12 rounded-[1.25rem] border border-dashed border-ink-muted/25 p-8 text-center">
            <p className="font-display text-2xl tracking-[-0.02em]">
              No reviews yet
            </p>
            <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-ink-muted">
              {brand.name} is new, and nobody has written one. Rather than fill
              this page with something we made up, it stays empty until a real
              person has something to say. If you are using {brand.shortName},
              you can write the first one from settings.
            </p>
          </section>
        ) : (
          <>
            {aggregate ? (
              <p className="mt-10 flex items-center gap-3 text-sm text-ink-muted">
                <Rating value={Math.round(aggregate.ratingValue)} />
                <span>
                  {aggregate.ratingValue} average from {aggregate.reviewCount}{" "}
                  reviews
                </span>
              </p>
            ) : null}
            <ul className="mt-8 space-y-4">
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </ul>
          </>
        )}

        <p className="mt-10 text-sm leading-7 text-ink-muted">
          Looking for something more specific?{" "}
          <Link className="font-semibold text-ink underline" href="/faq">
            The FAQ
          </Link>{" "}
          answers what {brand.shortName} costs, what happens to your notes, and
          whether the people you add ever find out.
        </p>
      </MarketingShell>
    </>
  );
}
