import type { Metadata } from "next";
import Link from "next/link";
import {
  MarketingShell,
  Section,
} from "@/components/marketing/marketing-shell";
import { brand } from "@/config/brand";
import { publicPageMetadata } from "@/lib/public-pages";
import { breadcrumbSchema, JsonLd, webPageSchema } from "@/lib/structured-data";

export const metadata: Metadata = publicPageMetadata("vsNotion");

export default function VsNotionPage() {
  return (
    <>
      <JsonLd
        schemas={[
          webPageSchema("vsNotion"),
          breadcrumbSchema([
            { name: brand.name, path: "/" },
            { name: "Siyi vs Notion", path: "/vs/notion" },
          ]),
        ]}
      />
      <MarketingShell
        eyebrow="Comparison"
        title="Siyi.app vs a Notion contacts database"
        lede="Almost everyone tries the Notion table first. It is free, you already have it, and building it is genuinely satisfying. Then it dies, usually somewhere around week three, and it is worth being precise about why."
      >
        <Section title="The table is not the problem">
          <p>
            Notion is excellent at what it is: a flexible database you shape
            however you want. A contacts table with columns for how you met,
            their major, last contacted and a notes field is a reasonable design,
            and for a few weeks it works fine.
          </p>
          <p>
            The problem is that it is a place you have to decide to go. A
            database only helps if you open it, and the entire failure mode being
            solved here is that you do not think about the person at all until
            it is too late to be graceful about it. A table that requires you to
            already be thinking about someone cannot remind you of someone.
          </p>
        </Section>

        <Section title="Where it gives out">
          <p>
            <strong className="text-ink">Capture friction.</strong> Adding a row
            means opening the app, finding the database, creating a page, and
            filling fields. That is maybe forty seconds, which is fine at your
            desk and impossible in a hallway. You tell yourself you will add them
            later, and later is where people go to be forgotten.
          </p>
          <p>
            <strong className="text-ink">Dates do not act.</strong> You can put a
            birthday in a date column and even get a reminder if you set one, one
            at a time, by hand, forever. Nothing reads &ldquo;said I&rsquo;d send
            him the notes&rdquo; and turns it into something that comes back.
          </p>
          <p>
            <strong className="text-ink">Silence is invisible.</strong> The most
            useful fact about a friendship is how long it has been. In a table,
            &ldquo;last contacted&rdquo; is a field you have to remember to
            update — so it is accurate for the first month and fiction after
            that.
          </p>
          <p>
            <strong className="text-ink">It is a project.</strong> Every hour
            spent tuning views and relations is an hour not spent texting the
            person. Systems that need maintenance get abandoned in exam season,
            which is precisely when you stop seeing people.
          </p>
        </Section>

        <Section title="What Siyi does instead">
          <p>
            One sentence, in seconds, offline if you have no signal. {brand.name}{" "}
            picks the birthday, the promise and the timing out of what you wrote,
            and then comes to you — surfacing the person on the day it matters
            rather than waiting to be opened. Time since your last conversation
            is computed, not typed. There is nothing to configure and no view to
            maintain.
          </p>
          <p>
            It is also private in a way a shared workspace is not: no feed,
            nothing shown to anyone, and no notification to the people you write
            about. You can export the whole thing as JSON or CSV and delete all
            of it whenever you want.
          </p>
        </Section>

        <Section title="When to stay in Notion">
          <p>
            If your whole life already lives in Notion and you genuinely enjoy
            maintaining it, the table is free and it is right there. Some people
            do keep one alive for years. If you have already watched two of them
            die, that is the signal the tool is not the missing piece — the
            reminder is.
          </p>
          <p>
            The{" "}
            <Link
              className="font-semibold text-ink underline"
              href="/for/college-students"
            >
              college case
            </Link>{" "}
            covers what to write in that one sentence.
          </p>
        </Section>
      </MarketingShell>
    </>
  );
}
