import type { Metadata } from "next";
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
      <PageHeader
        title="Who did you talk to today?"
        description="Tap everyone you saw or spoke to. One tap each, nothing to type."
      />
      <DailyCheckIn people={people.filter((person) => person.status !== "archived")} />
    </div>
  );
}
