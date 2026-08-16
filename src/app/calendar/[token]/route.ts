import { NextResponse, type NextRequest } from "next/server";
import {
  buildCalendarFeed,
  calendarTokenPattern,
} from "@/lib/calendar-feed";
import { brand } from "@/config/brand";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PersonRow = {
  id: string;
  full_name: string;
  preferred_name: string | null;
  birthday: string | null;
};

type ReminderRow = {
  id: string;
  text: string;
  due_at: string;
  completed_at: string | null;
  reminder_people: { person_id: string }[] | null;
};

/**
 * A calendar client fetches this with no cookie and no way to sign in, so the
 * token in the URL is the whole credential — which is why it is unguessable,
 * why the read runs as admin rather than as the user, and why a bad token
 * answers 404 rather than saying whether it was ever a real one.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, "");
  if (!calendarTokenPattern.test(token)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("user_profiles")
    .select("auth_user_id")
    .eq("calendar_token", token)
    .maybeSingle();

  if (!profile) return new NextResponse("Not found", { status: 404 });
  const userId = profile.auth_user_id as string;

  const [peopleResult, remindersResult] = await Promise.all([
    admin
      .from("people")
      .select("id,full_name,preferred_name,birthday")
      .eq("user_id", userId)
      // Everyone, not just the ones with a birthday: a reminder needs the
      // names of the people it is about, birthday or no birthday.
      .eq("status", "active"),
    admin
      .from("reminders")
      .select("id,text,due_at,completed_at,reminder_people(person_id)")
      .eq("user_id", userId)
      .is("completed_at", null),
  ]);

  if (peopleResult.error || remindersResult.error) {
    return new NextResponse("Calendar unavailable", { status: 503 });
  }

  const people = (peopleResult.data ?? []) as PersonRow[];
  const peopleById = new Map(people.map((person) => [person.id, person]));

  const body = buildCalendarFeed({
    people: people.map((person) => ({
      id: person.id,
      fullName: person.full_name,
      preferredName: person.preferred_name,
      birthday: person.birthday,
    })),
    reminders: ((remindersResult.data ?? []) as ReminderRow[]).map(
      (reminder) => ({
        id: reminder.id,
        text: reminder.text,
        dueAt: reminder.due_at,
        completedAt: reminder.completed_at,
        people: (reminder.reminder_people ?? [])
          .map((link) => peopleById.get(link.person_id))
          .filter((person): person is PersonRow => Boolean(person))
          .map((person) => ({
            id: person.id,
            fullName: person.full_name,
            preferredName: person.preferred_name,
            profilePhotoUrl: null,
          })),
      }),
    ),
    origin: new URL(request.url).origin,
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${brand.slug}.ics"`,
      // A subscribed feed is polled; there is nothing to gain from a cache in
      // front of it holding yesterday's birthdays.
      "Cache-Control": "private, no-store",
    },
  });
}
