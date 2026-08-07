import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { AddPersonForm } from "@/components/add-person-form";
import { PageHeader } from "@/components/page-header";
import { getDefaultUniversity } from "@/lib/own-card-server";

export const metadata: Metadata = {
  title: "Add someone",
};

export const dynamic = "force-dynamic";

export default async function AddPersonPage() {
  return (
    <div className="mx-auto max-w-[680px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <PageHeader
        eyebrow="While it’s fresh"
        title="Add someone"
        description="Start with the details you remember now. You can fill in the rest later."
        action={
          <Link
            href="/people"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-ink shadow-card ring-1 ring-black/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
            aria-label="Back to people"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </Link>
        }
      />
      <AddPersonForm defaultUniversity={await getDefaultUniversity()} />
    </div>
  );
}
