import type { Metadata } from "next";
import { FollowUpBoard } from "@/components/follow-up-board";
import { PageHeader } from "@/components/page-header";
import { QuickCaptureTrigger } from "@/components/quick-capture-hub";
import { getFollowUps, getPeople } from "@/lib/data";

export const metadata: Metadata = {
  title: "Follow-ups",
};

export const dynamic = "force-dynamic";

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const [followUps, people, parameters] = await Promise.all([
    getFollowUps(),
    getPeople(),
    searchParams,
  ]);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <PageHeader
        eyebrow="Keep your word"
        title="Follow-ups"
        description="A practical list of the things you said you’d send, ask, or do."
        action={
          <QuickCaptureTrigger
            mode="follow-up"
            label="Add follow-up"
            compact
          />
        }
      />
      <FollowUpBoard
        initialFollowUps={followUps}
        people={people}
        initialPersonId={parameters.person ?? "all"}
      />
    </div>
  );
}
