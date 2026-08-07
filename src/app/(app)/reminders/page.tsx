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

  // Notifications and person pages link here with ?person=, so that arrives as
  // a filled-in search rather than as a second, web-only filter control.
  const requestedPerson = people.find((person) => person.id === parameters.person);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-7 sm:px-7 sm:py-10 lg:px-10 lg:py-12">
      <PageHeader
        title="Reminders"
        description="What is coming up, and when it lands."
        action={
          <QuickCaptureTrigger mode="reminder" label="Add a reminder" />
        }
      />
      <ReminderBoard
        initialReminders={reminders}
        initialQuery={
          requestedPerson
            ? requestedPerson.preferredName || requestedPerson.fullName
            : ""
        }
      />
    </div>
  );
}
