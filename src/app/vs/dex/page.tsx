import type { Metadata } from "next";
import Link from "next/link";
import {
  MarketingShell,
  Section,
} from "@/components/marketing/marketing-shell";
import { brand } from "@/config/brand";
import { publicPageMetadata } from "@/lib/public-pages";
import { breadcrumbSchema, JsonLd, webPageSchema } from "@/lib/structured-data";

export const metadata: Metadata = publicPageMetadata("vsDex");

export default function VsDexPage() {
  return (
    <>
      <JsonLd
        schemas={[
          webPageSchema("vsDex"),
          breadcrumbSchema([
            { name: brand.name, path: "/" },
            { name: "Siyi vs Dex", path: "/vs/dex" },
          ]),
        ]}
      />
      <MarketingShell
        eyebrow="Comparison"
        title="Siyi.app vs Dex"
        lede="Both are personal CRMs. They are aimed at different people, and the difference is not a feature list — it is who the product thinks you are."
      >
        <Section title="The short version">
          <p>
            Dex is built for professionals managing a network: it syncs
            LinkedIn, watches for job changes across your contacts, pulls in
            email and calendar, and layers an AI assistant over the result. If
            your relationships live in a CRM-shaped part of your life — clients,
            recruiters, a few hundred industry contacts — that is the shape of
            tool you want.
          </p>
          <p>
            {brand.name} is built for the people physically around you right
            now. Classmates, the club, someone from a party, the friend from
            freshman year you keep meaning to text. Nobody in that group has a
            job title worth syncing, and none of it lives in your inbox.
          </p>
        </Section>

        <Section title="Where the two actually diverge">
          <p>
            <strong className="text-ink">The unit of capture.</strong> Dex is
            organized around importing a network you already have and enriching
            it. {brand.name} is organized around the ninety seconds after you
            meet someone new, when the only record that will ever exist is the
            one you make. You write a sentence; it becomes the person.
          </p>
          <p>
            <strong className="text-ink">What triggers a reminder.</strong> A
            professional CRM nudges you on cadence and on job changes. {brand.name}{" "}
            nudges on the things that matter in a life that is not a sales
            pipeline: a birthday, a favor you promised and have not done, a
            friend who has quietly gone six months without a conversation.
          </p>
          <p>
            <strong className="text-ink">Price.</strong> {brand.name} is free,
            with no contact cap and no trial clock. Dex is a paid product —{" "}
            <Link
              className="font-semibold text-ink underline"
              href="https://getdex.com"
              rel="noopener"
              target="_blank"
            >
              see their pricing page
            </Link>{" "}
            for current plans. For a student that gap is usually the end of the
            conversation.
          </p>
        </Section>

        <Section title="When Dex is the better answer">
          <p>
            If your contacts are professional, numerous, and already sitting in
            LinkedIn and Gmail, Dex&rsquo;s integrations do work that {brand.name}{" "}
            does not attempt. We do not sync LinkedIn, we do not read your
            inbox, and we are not going to tell you when someone changes
            employer. If those are the features you are shopping for, buy the
            tool built around them.
          </p>
        </Section>

        <Section title="When Siyi is">
          <p>
            You are in college or just out of it. You are meeting people
            constantly and in person. You want something free that takes one
            sentence and does not ask you to maintain it. And you want the
            people you write about to never find out — there is no feed, no
            profile, and no notification to anyone.
          </p>
          <p>
            The{" "}
            <Link
              className="font-semibold text-ink underline"
              href="/for/college-students"
            >
              college case
            </Link>{" "}
            spells out what that looks like day to day.
          </p>
        </Section>
      </MarketingShell>
    </>
  );
}
