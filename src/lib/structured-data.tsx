import { brand } from "@/config/brand";
import { publicPages, type PublicPageKey } from "@/lib/public-pages";
import { absoluteUrl, siteUrl } from "@/lib/site-url";

/**
 * What a search engine, and increasingly a language model, reads to decide what
 * this site *is* rather than what it says. Everything here is derived from
 * `brand` and `publicPages` for the same reason the sitemap is: a description
 * that disagrees with the indexed one reads as two different products.
 *
 * Nothing in here may state a fact that is not true on the page rendering it.
 * Ratings in particular are built from stored rows, never written down.
 */

const organizationId = `${siteUrl}/#organization`;
const websiteId = `${siteUrl}/#website`;

/**
 * The profiles that establish this is one entity across the web. A model
 * resolving "Siyi" follows these; a URL that 404s costs more than a missing one,
 * so a profile goes in here only once it exists and is claimed.
 */
const sameAs = ["https://github.com/borisnezlobin/siyi.app"];

export function organizationSchema() {
  return {
    "@type": "Organization",
    "@id": organizationId,
    name: brand.name,
    // "Siyi app" is what someone types when they cannot remember whether the
    // .app is part of the name. Without it that search has nothing to match.
    alternateName: [brand.shortName, `${brand.shortName} app`],
    url: siteUrl,
    description: brand.description,
    email: brand.supportEmail,
    foundingLocation: "Berkeley, California",
    sameAs,
  };
}

export function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": websiteId,
    name: brand.name,
    alternateName: [brand.shortName, `${brand.shortName} app`],
    url: siteUrl,
    publisher: { "@id": organizationId },
    inLanguage: "en-US",
  };
}

export function softwareApplicationSchema() {
  return {
    "@type": "SoftwareApplication",
    "@id": `${siteUrl}/#app`,
    name: brand.name,
    applicationCategory: "LifestyleApplication",
    applicationSubCategory: "Personal CRM",
    operatingSystem: "iOS, Android, Web",
    url: siteUrl,
    description: publicPages.home.description,
    publisher: { "@id": organizationId },
    // Free, and saying so is what lets a model answer "is it free" without
    // guessing. Change this the day that stops being true.
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };
}

export function webPageSchema(key: PublicPageKey) {
  const page = publicPages[key];

  return {
    "@type": "WebPage",
    "@id": `${absoluteUrl(page.path)}#webpage`,
    url: absoluteUrl(page.path),
    name: page.title,
    description: page.description,
    isPartOf: { "@id": websiteId },
  };
}

type Crumb = { name: string; path: string };

export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/**
 * Reviews of the app, attached to the app node so a search engine reads them as
 * being about the product rather than about the page.
 *
 * Both arguments come from stored rows. Nothing here may be written by hand:
 * a rating in the markup that no user actually gave is a Google structured-data
 * violation and an FTC one at the same time, and it is the kind of thing that
 * is trivial to add and impossible to explain later.
 */
export function reviewsSchema(
  reviews: { authorLabel: string; rating: number; body: string; publishedAt: string | null }[],
  aggregate: { ratingValue: number; reviewCount: number } | null,
) {
  return {
    "@type": "SoftwareApplication",
    "@id": `${siteUrl}/#app`,
    ...(aggregate
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: aggregate.ratingValue,
            reviewCount: aggregate.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    review: reviews.map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.authorLabel },
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.rating,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: review.body,
      ...(review.publishedAt ? { datePublished: review.publishedAt } : {}),
    })),
  };
}

export type FaqEntry = { question: string; answer: string };

export function faqSchema(entries: FaqEntry[]) {
  return {
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

/**
 * One graph per page rather than a stack of separate script tags, so the nodes
 * can reference each other by `@id` instead of repeating themselves.
 */
export function JsonLd({ schemas }: { schemas: object[] }) {
  const graph = {
    "@context": "https://schema.org",
    "@graph": schemas,
  };

  return (
    <script
      type="application/ld+json"
      // The content is built here from typed objects, never from user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
