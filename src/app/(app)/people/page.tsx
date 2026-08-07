import { Cake, GraduationCap, GlobeHemisphereWest, Plus } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { PeopleDirectory } from "@/components/people-directory";
import { getClassesByPerson } from "@/lib/classes-server";
import { getPeople } from "@/lib/data";

export const metadata: Metadata = {
  title: "People",
};

export const dynamic = "force-dynamic";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; added?: string }>;
}) {
  const [people, parameters] = await Promise.all([getPeople(), searchParams]);
  const initialFilter =
    parameters.filter === "overdue" || parameters.filter === "recent"
      ? parameters.filter
      : "all";

  return (
    <div className="mx-auto max-w-[760px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <PageHeader
        eyebrow="Your circle"
        title="People"
        description="Names, context, and the small details that make reconnecting easy."
        action={
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/birthdays"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-paper text-ink shadow-card transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
              aria-label="See everyone's birthdays"
            >
              <Cake size={20} aria-hidden="true" />
            </Link>
            <Link
              href="/classes"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-paper text-ink shadow-card transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
              aria-label="See who shares your classes"
            >
              <GraduationCap size={20} aria-hidden="true" />
            </Link>
            <Link
              href="/map"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-paper text-ink shadow-card transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
              aria-label="See where everyone's from"
            >
              <GlobeHemisphereWest size={20} aria-hidden="true" />
            </Link>
            <Link
              href="/people/new"
              className="grid size-11 shrink-0 place-items-center rounded-full bg-coral text-white shadow-float transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
              aria-label="Add someone"
            >
              <Plus size={20} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        }
      />
      {parameters.added ? (
        <p
          role="status"
          className="mt-5 rounded-2xl bg-sage px-4 py-3 text-sm font-semibold text-sage-strong"
        >
          Person saved. A “met” update was logged automatically.
        </p>
      ) : null}
      <PeopleDirectory
        classesByPerson={Object.fromEntries(await getClassesByPerson())}
        people={people}
        initialFilter={initialFilter}
      />
    </div>
  );
}
