import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing/marketing-shell";
import { brand } from "@/config/brand";
import { faqEntries } from "@/lib/faq";
import { publicPageMetadata } from "@/lib/public-pages";
import {
  breadcrumbSchema,
  faqSchema,
  JsonLd,
  webPageSchema,
} from "@/lib/structured-data";

export const metadata: Metadata = publicPageMetadata("faq");

export default function FaqPage() {
  return (
    <>
      <JsonLd
        schemas={[
          webPageSchema("faq"),
          faqSchema(faqEntries),
          breadcrumbSchema([
            { name: brand.name, path: "/" },
            { name: "Questions", path: "/faq" },
          ]),
        ]}
      />
      <MarketingShell
        eyebrow="Questions"
        title="Questions people ask about Siyi"
        lede={`Short answers, in the order people tend to ask them. If yours is not here, ${brand.supportEmail} reaches a person.`}
      >
        <dl className="mt-12 space-y-8">
          {faqEntries.map((entry) => (
            <div key={entry.question}>
              <dt className="font-display text-[1.55rem] leading-tight tracking-[-0.02em]">
                {entry.question}
              </dt>
              <dd className="mt-3 text-base leading-8 text-ink-muted">
                {entry.answer}
              </dd>
            </div>
          ))}
        </dl>
      </MarketingShell>
    </>
  );
}
