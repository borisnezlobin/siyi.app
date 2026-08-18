import type { Metadata } from "next";
import Link from "next/link";
import {
  MarketingShell,
  Section,
} from "@/components/marketing/marketing-shell";
import { brand } from "@/config/brand";
import { publicPageMetadata } from "@/lib/public-pages";
import { breadcrumbSchema, JsonLd, webPageSchema } from "@/lib/structured-data";

export const metadata: Metadata = publicPageMetadata("forClubs");

export default function ForClubsPage() {
  return (
    <>
      <JsonLd
        schemas={[
          webPageSchema("forClubs"),
          breadcrumbSchema([
            { name: brand.name, path: "/" },
            { name: "Clubs", path: "/for/clubs" },
          ]),
        ]}
      />
      <MarketingShell
        eyebrow="For clubs and orgs"
        title="Forty new faces at the first meeting"
        lede="A club is the fastest way to meet a lot of people and the fastest way to lose them. Everyone introduces themselves once, in a circle, and by the third meeting you are nodding at someone whose name you were too embarrassed to ask for twice."
      >
        <Section title="The name you missed on day one">
          <p>
            There is a point — usually around week three — after which asking
            someone&rsquo;s name again feels like admitting you never listened.
            So you stop asking, and you spend the rest of the semester
            navigating around it. The fix is not a better memory. It is writing
            the name down in the ninety seconds after you hear it, while you
            still have the face attached.
          </p>
          <p>
            One line is enough. Name, what they said when it was their turn, and
            something about how they look or where they sat. You will not need
            the last part for long, but the first week you will need it badly.
          </p>
        </Section>

        <Section title="Officers have a different problem">
          <p>
            If you run the club, you are tracking who said they would come, who
            actually came, who volunteered for the thing and then went quiet,
            and who is about to drift off entirely. Most orgs handle this with a
            group chat and a spreadsheet that one person maintains and nobody
            reads.
          </p>
          <p>
            The useful signal is time since last contact. Someone who has not
            been at anything in six weeks has usually not decided to quit — they
            have just fallen out of the loop, and a single message naming
            something specific they worked on brings a surprising number of them
            back.
          </p>
        </Section>

        <Section title="How Siyi handles it">
          <p>
            {brand.name} lets you add someone in seconds, tag them however you
            think about them, and search across notes, tags, majors and
            residences later. It shows you time since your last conversation and
            surfaces people you have gone quiet on, so the drift is visible
            before it is permanent.
          </p>
          <p>
            Notes are yours alone — nobody in the club is notified, and there is
            nothing anyone else can see. It works the same way for the officer
            keeping the org alive and for the freshman trying to remember who
            sits by the window.
          </p>
        </Section>

        <Section title="Related">
          <p>
            <Link
              className="font-semibold text-ink underline"
              href="/for/college-students"
            >
              The broader case for keeping track in college
            </Link>{" "}
            covers what to write down the day you meet someone, and the{" "}
            <Link className="font-semibold text-ink underline" href="/faq">
              FAQ
            </Link>{" "}
            answers what happens to your notes.
          </p>
        </Section>
      </MarketingShell>
    </>
  );
}
