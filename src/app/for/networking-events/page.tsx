import type { Metadata } from "next";
import Link from "next/link";
import {
  MarketingShell,
  Section,
} from "@/components/marketing/marketing-shell";
import { brand } from "@/config/brand";
import { publicPageMetadata } from "@/lib/public-pages";
import { breadcrumbSchema, JsonLd, webPageSchema } from "@/lib/structured-data";

export const metadata: Metadata = publicPageMetadata("forNetworkingEvents");

export default function ForNetworkingEventsPage() {
  return (
    <>
      <JsonLd
        schemas={[
          webPageSchema("forNetworkingEvents"),
          breadcrumbSchema([
            { name: brand.name, path: "/" },
            { name: "Networking events", path: "/for/networking-events" },
          ]),
        ]}
      />
      <MarketingShell
        eyebrow="For career fairs and networking"
        title="The follow-up is the whole point, and it is the part everyone drops"
        lede="You talked to eleven people in two hours, collected six business cards and a QR code, and left with a phone full of names you will not be able to match to faces by Thursday. Nothing that happened in that room matters unless something happens after it."
      >
        <Section title="Write it before you leave the building">
          <p>
            The half-life on this is hours, not days. Before you get on the bus,
            go through the people you actually spoke to and write one line each:
            who they are, one specific thing from the conversation, and what you
            said you would do. The specific thing is the part that makes a
            follow-up email land — &ldquo;you mentioned your team is rebuilding
            the onboarding flow&rdquo; is a different message from &ldquo;it was
            great to meet you.&rdquo;
          </p>
          <p>
            Do not rely on the card. A card tells you a name and a company,
            which is exactly the information you could have looked up anyway.
            What you cannot reconstruct later is what was said.
          </p>
        </Section>

        <Section title="Two days, then two weeks, then a quarter">
          <p>
            The follow-up nobody sends is not the first one — it is the second.
            Most people manage a thank-you within a couple of days and then go
            silent forever, which reads as someone who wanted something once. A
            note two weeks later about the thing they mentioned, and a check-in
            a few months on, is the entire difference between a contact and a
            relationship.
          </p>
          <p>
            That cadence is trivial to describe and nearly impossible to
            maintain by memory across a dozen people at once. It is the specific
            job a reminder is good at.
          </p>
        </Section>

        <Section title="How Siyi handles it">
          <p>
            Capture works offline, so you can write the eleven lines standing in
            the hallway with no signal and let them sync later. {brand.name}{" "}
            picks the dates and promises out of what you wrote and puts each
            person back in front of you when the follow-up is actually due —
            two days, two weeks, or next quarter — rather than leaving you to
            remember which stage each of eleven people is at.
          </p>
        </Section>

        <Section title="Related">
          <p>
            If your follow-ups are mostly professional and you are managing a
            large LinkedIn network,{" "}
            <Link className="font-semibold text-ink underline" href="/vs/dex">
              the comparison with Dex
            </Link>{" "}
            is worth reading — it is built for exactly that, and {brand.shortName}{" "}
            is not.
          </p>
        </Section>
      </MarketingShell>
    </>
  );
}
