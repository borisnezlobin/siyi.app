import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { peopleByCourse } from "@/lib/classes";
import { getClassesByPerson } from "@/lib/classes-server";
import { getPeople } from "@/lib/data";

export const metadata: Metadata = {
  title: "Classes",
};

export const dynamic = "force-dynamic";

export default async function ClassesPage() {
  const [people, classesByPerson] = await Promise.all([
    getPeople(),
    getClassesByPerson(),
  ]);

  const groups = peopleByCourse(
    people
      .filter((person) => person.status !== "archived")
      .map((person) => ({
        id: person.id,
        name: person.preferredName || person.fullName,
        classes: classesByPerson.get(person.id) ?? [],
      })),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-8">
      <PageHeader
        title="Classes"
        description="Who you have a course with, built from what you have written down."
      />

      {groups.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="font-display text-2xl">No classes saved yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink-muted">
            Add a class on someone&apos;s profile and it will show up here. You can
            then search for everyone in a course, or with a professor.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {groups.map((group) => (
            <li key={group.code} className="rounded-2xl bg-white p-4">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-sm font-bold">
                  {group.code}
                  {group.title ? (
                    <span className="font-normal text-ink-muted"> · {group.title}</span>
                  ) : null}
                </h2>
                <span className="shrink-0 text-xs font-semibold text-ink-muted">
                  {group.people.length}
                </span>
              </div>
              {group.professors.length > 0 ? (
                <p className="mt-0.5 text-xs text-ink-muted">
                  {group.professors.join(", ")}
                </p>
              ) : null}
              <p className="mt-2 text-sm leading-6">
                {group.people.map((person, index) => (
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
