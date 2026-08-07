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
      <PageHeader
        title={`Edit ${person.preferredName ?? person.fullName}`}
        description="Update the details that make the next conversation easier."
        action={
          <Link
            href={`/people/${person.id}`}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-ink shadow-card ring-1 ring-black/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            aria-label={`Back to ${person.fullName}`}
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        }
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
