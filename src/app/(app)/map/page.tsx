import { ArrowLeft, MapPin, Question } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { HometownMap } from "@/components/hometown-map";
import { PageHeader } from "@/components/page-header";
import { type MapMode, summariseHometowns } from "@/lib/geocode";
import { getPeople } from "@/lib/data";

export const metadata: Metadata = {
  title: "Map",
};

export const dynamic = "force-dynamic";

function peopleSentence(count: number) {
  return count === 1 ? "1 person" : `${count} people`;
}

function PersonLinks({ people }: { people: { id: string; name: string }[] }) {
  return (
    <p className="mt-1 text-sm leading-6 text-ink-muted">
      {people.map((person, index) => (
        <span key={person.id}>
          {index > 0 ? ", " : null}
          <Link
            href={`/people/${person.id}`}
            className="font-medium text-ink underline decoration-sage-strong/40 underline-offset-4 hover:decoration-sage-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            {person.name}
          </Link>
        </span>
      ))}
    </p>
  );
}

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ by?: string }>;
}) {
  const mode: MapMode = (await searchParams).by === "college" ? "college" : "hometown";
  const people = await getPeople();
  const { places, unplaced, withoutHometown } = summariseHometowns(
    people
      .filter((person) => person.status !== "archived")
      .map((person) => ({
        id: person.id,
        name: person.preferredName || person.fullName,
        hometown: person.hometown,
        university: person.university,
      })),
    mode,
  );

  const noun = mode === "college" ? "school" : "hometown";

  const placedCount = places.reduce((total, place) => total + place.people.length, 0);
  const approximate = places.filter((place) => place.precision !== "city");

  return (
    <div className="mx-auto max-w-[760px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <Link
        href="/people"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        <ArrowLeft size={16} weight="bold" aria-hidden="true" />
        People
      </Link>

      <PageHeader
        title={mode === "college" ? "Where everyone studies" : "Where everyone's from"}
        description={
          mode === "college"
            ? "Built from the schools you've written down, placed with a college list kept inside the app. Nothing about your people is sent anywhere to draw this."
            : "Built from the hometowns you've written down, matched against a list of places kept inside the app. Nothing about your people is sent anywhere to draw this."
        }
      />

      <div
        className="mt-6 inline-flex rounded-2xl bg-ink/[0.06] p-1"
        role="tablist"
        aria-label="Map by"
      >
        {(
          [
            ["hometown", "Hometown", "/map"],
            ["college", "College", "/map?by=college"],
          ] as const
        ).map(([value, label, href]) => (
          <Link
            key={value}
            href={href}
            role="tab"
            aria-selected={mode === value}
            className={
              mode === value
                ? "rounded-xl bg-paper px-4 py-2 text-sm font-semibold text-ink shadow-card"
                : "rounded-xl px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink"
            }
          >
            {label}
          </Link>
        ))}
      </div>

      {places.length === 0 && unplaced.length === 0 ? (
        <p className="mt-8 rounded-3xl bg-paper p-6 text-sm leading-6 text-ink-muted shadow-card">
          No one has a {noun} saved yet. Add one to someone&rsquo;s profile and
          they&rsquo;ll show up here.
        </p>
      ) : (
        <>
          <div className="mt-8">
            <HometownMap places={places} />
          </div>

          <p className="mt-4 text-sm leading-6 text-ink-muted">
            {peopleSentence(placedCount)} placed across{" "}
            {places.length === 1 ? "one place" : `${places.length} places`}.
            {approximate.length > 0
              ? " Hollow pins are approximate — we only knew the state or country."
              : null}
          </p>

          <section className="mt-9" aria-labelledby="places-heading">
            <h2
              id="places-heading"
              className="font-display text-2xl tracking-[-0.02em] text-ink"
            >
              Places
            </h2>
            <ul className="mt-4 space-y-3">
              {places.map((place) => (
                <li
                  key={place.key}
                  id={`place-${place.key}`}
                  className="scroll-mt-6 rounded-2xl bg-paper p-4 shadow-card"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <MapPin
                        size={16}
                        weight={place.precision === "city" ? "fill" : "regular"}
                        className="shrink-0 text-coral"
                        aria-hidden="true"
                      />
                      {place.label}
                    </h3>
                    <span className="shrink-0 text-xs font-semibold text-ink-muted">
                      {place.people.length}
                    </span>
                  </div>
                  {place.precision !== "city" ? (
                    <p className="mt-1 text-xs text-ink-muted">
                      Approximate — pinned to the middle of the{" "}
                      {place.precision === "region" ? "state or region" : "country"}.
                    </p>
                  ) : null}
                  <PersonLinks people={place.people} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      {unplaced.length > 0 ? (
        <section className="mt-9" aria-labelledby="unplaced-heading">
          <h2
            id="unplaced-heading"
            className="font-display text-2xl tracking-[-0.02em] text-ink"
          >
            Couldn&rsquo;t place these
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink-muted">
            Either the place isn&rsquo;t in our list, or the name belongs to more
            than one place and we&rsquo;d rather leave it off than guess wrong.
            Adding a state or country usually sorts it out.
          </p>
          <ul className="mt-4 space-y-3">
            {unplaced.map((item) => (
              <li key={item.hometown} className="rounded-2xl bg-paper p-4 shadow-card">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <Question
                      size={16}
                      className="shrink-0 text-ink-muted"
                      aria-hidden="true"
                    />
                    {item.hometown}
                  </h3>
                  <span className="shrink-0 text-xs font-semibold text-ink-muted">
                    {item.people.length}
                  </span>
                </div>
                <PersonLinks people={item.people} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {withoutHometown.length > 0 ? (
        <p className="mt-9 rounded-2xl bg-sage px-4 py-3 text-sm leading-6 text-sage-strong">
          {peopleSentence(withoutHometown.length)}{" "}
          {withoutHometown.length === 1 ? "has" : "have"} no {noun} saved yet.
        </p>
      ) : null}

      {/* CC BY asks for the credit to be visible, not buried in a comment. */}
      <p className="mt-9 text-xs leading-5 text-ink-muted">
        Places come from{" "}
        <a
          href="https://www.geonames.org/"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2 hover:text-ink"
        >
          GeoNames
        </a>{" "}
        (CC BY 4.0) and country outlines from{" "}
        <a
          href="https://www.naturalearthdata.com/"
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2 hover:text-ink"
        >
          Natural Earth
        </a>
        . Both are stored with Siyi, so nobody&rsquo;s hometown is ever sent
        anywhere to draw this map.
      </p>
    </div>
  );
}
