import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { DailyCheckIn } from "@/components/daily-check-in";
import { PageHeader } from "@/components/page-header";
import { getPeople } from "@/lib/data";

export const metadata: Metadata = {
  title: "Check in",
};

export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const people = await getPeople();

  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-8">
      <Link
        href="/today"
        className="inline-flex items-center gap-2 rounded-lg py-2 text-sm font-semibold text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
      >
        <ArrowLeft aria-hidden="true" size={17} weight="bold" />
        Today
      </Link>
      <PageHeader
        title="Who did you talk to today?"
        description="Tap everyone you saw or spoke to. One tap each, nothing to type."
      />
      <DailyCheckIn people={people.filter((person) => person.status !== "archived")} />
    </div>
  );
}
