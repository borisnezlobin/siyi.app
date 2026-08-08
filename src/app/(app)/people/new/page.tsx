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
      <Link
        href="/people"
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        <ArrowLeft size={16} weight="bold" aria-hidden="true" />
        People
      </Link>

      <PageHeader
        title="Add someone"
        description="Start with the details you remember now. You can fill in the rest later."
      />
      <AddPersonForm defaultUniversity={await getDefaultUniversity()} />
    </div>
  );
}
