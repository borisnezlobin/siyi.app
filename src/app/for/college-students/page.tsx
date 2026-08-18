import type { Metadata } from "next";
import Link from "next/link";
import {
  MarketingShell,
  Section,
} from "@/components/marketing/marketing-shell";
import { brand } from "@/config/brand";
import { publicPageMetadata } from "@/lib/public-pages";
import { breadcrumbSchema, JsonLd, webPageSchema } from "@/lib/structured-data";

export const metadata: Metadata = publicPageMetadata("forCollegeStudents");

export default function ForCollegeStudentsPage() {
  return (
    <>
      <JsonLd
        schemas={[
          webPageSchema("forCollegeStudents"),
          breadcrumbSchema([
            { name: brand.name, path: "/" },
            { name: "College students", path: "/for/college-students" },
          ]),
        ]}
      />
      <MarketingShell
        eyebrow="For college students"
        title="A personal CRM built for college, not for sales"
        lede="In your first month you will meet more people than you did in the four years before it — in a dorm hallway, at a club fair, in a discussion section, at a party where the music was too loud to catch a last name. Almost all of them evaporate by November."
      >
        <Section title="Why the people you meet disappear">
          <p>
            Not because you did not care. Because meeting someone and keeping
            them are two different skills, and college only teaches the first
            one. You meet forty people in a week, your phone fills with numbers
            attached to first names, and three months later you cannot place
            half of them. The friendship never failed — it just never got a
            second contact.
          </p>
          <p>
            The window is narrower than it feels. Someone you met at orientation
            is easy to text in week two and awkward to text in week nine, and
            the difference is entirely whether anything happened in between.
          </p>
        </Section>

        <Section title="What to write down, and when">
          <p>
            The day you meet someone, write one sentence. Not a profile — a
            sentence. Where you met, and one thing they said. &ldquo;Priya, from
            the co-op tour, doing MCB, has a dog named Waffle back home.&rdquo;
            That is enough to make a conversation two weeks later feel like a
            continuation instead of a restart.
          </p>
          <p>
            Whatever you promised goes in too. You said you would send them the
            problem set, or introduce them to someone in the club, or come to
            their show. Promises are the highest-value thing in the whole
            notebook, and they are the first thing to fall out of your head.
          </p>
        </Section>

        <Section title="How Siyi handles the rest">
          <p>
            {brand.name} reads the dates and the promises out of what you wrote
            and brings the person back at the right moment: the week of their
            birthday, the day the favor is due, or after enough months of
            silence that you would want to know. You are not maintaining a
            database. You are writing a sentence and getting a nudge.
          </p>
          <p>
            There is no feed, no streak, and no score. Nobody you add is told
            they are in there. It is a private notebook, and the only person it
            ever performs for is you.
          </p>
        </Section>

        <Section title="Where it fits the rest of college">
          <p>
            Most people meet the bulk of their year in three places, and each
            one has a different failure mode:{" "}
            <Link className="font-semibold text-ink underline" href="/for/clubs">
              clubs, where forty faces arrive at once
            </Link>
            , and{" "}
            <Link
              className="font-semibold text-ink underline"
              href="/for/networking-events"
            >
              career fairs, where the follow-up is the entire point
            </Link>
            . Dorm floors take care of themselves for a semester and then stop.
          </p>
          <p>
            If you have already tried to solve this with a table, the{" "}
            <Link className="font-semibold text-ink underline" href="/vs/notion">
              comparison with a Notion contacts database
            </Link>{" "}
            covers exactly where that approach gives out.
          </p>
        </Section>
      </MarketingShell>
    </>
  );
}
