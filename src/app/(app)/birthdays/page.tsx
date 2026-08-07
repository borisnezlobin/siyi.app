import type { Metadata } from "next";
import { BirthdayCalendarView } from "@/components/birthday-calendar-view";
import { PageHeader } from "@/components/page-header";
import { getPeople } from "@/lib/data";

export const metadata: Metadata = {
  title: "Birthdays",
};

export default async function BirthdaysPage() {
  const everyone = await getPeople();
  const people = everyone.filter((person) => person.status !== "archived");
  const withBirthday = people.filter((person) => person.birthday).length;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-8">
      <PageHeader
        title="Birthdays"
        description={`${withBirthday} of ${people.length} people have a birthday saved.`}
      />
      <BirthdayCalendarView
        people={people.map((person) => ({
          id: person.id,
          fullName: person.fullName,
          preferredName: person.preferredName,
          birthday: person.birthday,
        }))}
      />
    </div>
  );
}
