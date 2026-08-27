import type { Metadata } from "next";
import Link from "next/link";
import {
  MarketingShell,
  Section,
} from "@/components/marketing/marketing-shell";
import { brand } from "@/config/brand";
import { publicPageMetadata } from "@/lib/public-pages";
import { breadcrumbSchema, JsonLd, webPageSchema } from "@/lib/structured-data";

export const metadata: Metadata = publicPageMetadata("vsMonica");

export default function VsMonicaPage() {
  return (
    <>
      <JsonLd
        schemas={[
          webPageSchema("vsMonica"),
          breadcrumbSchema([
            { name: brand.name, path: "/" },
            { name: "Siyi vs Monica", path: "/vs/monica" },
          ]),
        ]}
      />
      <MarketingShell
        eyebrow="Comparison"
        title="Siyi.app vs Monica"
        lede="Monica is the open-source personal CRM, and it has been the honest answer for self-hosters for years. The question is whether you want to run software or use it."
      >
        <Section title="The short version">
          <p>
            Monica is open source and can be self-hosted, which means the code
            is inspectable, your data sits on infrastructure you control, and
            the software costs nothing beyond the server. There is also a hosted
            version if you would rather not run it yourself. It is a genuinely
            good project and the privacy story is one you can verify yourself.
          </p>
          <p>
            {brand.name} is a free hosted app that works on your phone the
            minute you install it. There is nothing to deploy, no database to
            back up, and no VPS bill. It is built phone-first, for capture in
            the moment rather than data entry later.
          </p>
        </Section>

        <Section title="Where the two actually diverge">
          <p>
            <strong className="text-ink">Setup.</strong> Self-hosting Monica
            means a server, a deployment, and staying on top of updates and
            backups. That is a fair trade if you already run a homelab and a bad
            one if the thing standing between you and remembering your friends
            is a Docker compose file. {brand.name} has no setup.
          </p>
          <p>
            <strong className="text-ink">Where you use it.</strong> Monica is
            web-first and rewards sitting down and filling things in.{" "}
            {brand.name} has native iOS and Android apps and an offline queue, so
            the note you write on the walk home lands whether or not you had
            signal. Most of what you want to remember is captured standing up.
          </p>
          <p>
            <strong className="text-ink">What happens after you write.</strong>{" "}
            {brand.name} reads dates and promises out of your note and brings
            the person back on the day it matters, so keeping the notebook
            current is not a chore you have to remember to do.
          </p>
        </Section>

        <Section title="When Monica is the better answer">
          <p>
            You want to own the data outright on your own hardware, you want to
            read or modify the source, or self-hosting is a feature to you
            rather than a cost. Those are real reasons and {brand.name} does not
            match them: we are a hosted service, and while you can export
            everything as JSON or CSV and delete it all whenever you like, that
            is not the same thing as running it yourself.
          </p>
        </Section>

        <Section title="When Siyi is">
          <p>
            You want it working in two minutes, on your phone, for free, and you
            would like it to do something with what you wrote rather than just
            store it. If you are a student in particular, the{" "}
            <Link
              className="font-semibold text-ink underline"
              href="/for/college-students"
            >
              college case
            </Link>{" "}
            is the closest fit, and the{" "}
            <Link className="font-semibold text-ink underline" href="/faq">
              FAQ
            </Link>{" "}
            covers export and deletion in detail.
          </p>
          <p>
            Monica&rsquo;s own site is at{" "}
            <Link
              className="font-semibold text-ink underline"
              href="https://www.monicahq.com"
              rel="noopener"
              target="_blank"
            >
              monicahq.com
            </Link>{" "}
            if you want to compare directly.
          </p>
        </Section>
      </MarketingShell>
    </>
  );
}
