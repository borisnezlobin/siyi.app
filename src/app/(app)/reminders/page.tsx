import type { Metadata } from "next";
import { ReminderBoard } from "@/components/reminder-board";
import { PageHeader } from "@/components/page-header";
import { QuickCaptureTrigger } from "@/components/quick-capture-hub";
import { getReminders, getPeople } from "@/lib/data";

export const metadata: Metadata = {
  title: "Reminders",
};

export const dynamic = "force-dynamic";

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string }>;
}) {
  const [reminders, people, parameters] = await Promise.all([
    getReminders(),
    getPeople(),
    searchParams,
  ]);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <PageHeader
        eyebrow="Keep your word"
        title="Reminders"
        description="A practical list of the things you said you’d send, ask, or do."
        action={
          <QuickCaptureTrigger
            mode="reminder"
            label="Add reminder"
            compact
          />
        }
      />
      <ReminderBoard
        initialReminders={reminders}
        people={people}
        initialPersonId={parameters.person ?? "all"}
      />
    </div>
  );
}
