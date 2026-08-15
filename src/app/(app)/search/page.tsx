import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SearchView } from "@/components/search-view";
import { getPeople } from "@/lib/data";

export const metadata: Metadata = {
  title: "Search",
};

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // The API answers with person ids; the names and faces to group them under
  // come from here, the same list the directory renders.
  const [people, params] = await Promise.all([getPeople(), searchParams]);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <PageHeader
        title="Search"
        description="One box for everything you have written down — people, updates, notes, interactions, classes and reminders."
      />
      <SearchView
        initialQuery={params.q ?? ""}
        people={people.map((person) => ({
          id: person.id,
          fullName: person.fullName,
          preferredName: person.preferredName,
          profilePhotoUrl: person.profilePhotoUrl,
        }))}
      />
    </div>
  );
}
