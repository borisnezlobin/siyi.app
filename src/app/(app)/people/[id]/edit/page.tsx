import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { EditPersonForm } from "@/components/edit-person-form";
import { PageHeader } from "@/components/page-header";
import {
  getPerson,
  getPersonNoteSections,
  getUsedNoteHeadings,
} from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit person",
};

export default async function EditPersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [person, noteSections, headingsUsedElsewhere] = await Promise.all([
    getPerson(id),
    getPersonNoteSections(id),
    getUsedNoteHeadings(),
  ]);

  return (
    <div className="mx-auto max-w-[720px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <Link
        href={`/people/${person.id}`}
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        <ArrowLeft size={16} weight="bold" aria-hidden="true" />
        {person.preferredName ?? person.fullName}
      </Link>

      <PageHeader
        title={`Edit ${person.preferredName ?? person.fullName}`}
        description="Update the details that make the next conversation easier."
      />
      <EditPersonForm
        person={person}
        noteSections={noteSections.sections}
        noteSectionsAvailable={noteSections.available}
        headingsUsedElsewhere={headingsUsedElsewhere}
      />
    </div>
  );
}
