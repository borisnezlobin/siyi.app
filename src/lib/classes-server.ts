import { randomUUID } from "node:crypto";
import { getAuthenticatedUser } from "@/lib/auth";
import { normalizeCourseCode, type PersonClass } from "@/lib/classes";
import {
  isMissingSchema,
  readFallback,
  writeFallback,
} from "@/lib/schema-fallback";
import { createClient } from "@/lib/supabase/server";

type ClassRow = {
  id: string;
  person_id: string;
  course_code: string;
  course_title: string | null;
  professor: string | null;
  term: string | null;
  days: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
};

function mapClass(row: ClassRow): PersonClass {
  return {
    id: row.id,
    personId: row.person_id,
    courseCode: row.course_code,
    courseTitle: row.course_title,
    professor: row.professor,
    term: row.term,
    days: row.days,
    // Postgres hands back "10:00:00"; only the clock part matters here.
    startsAt: row.starts_at?.slice(0, 5) ?? null,
    endsAt: row.ends_at?.slice(0, 5) ?? null,
    location: row.location,
  };
}

type Client = Awaited<ReturnType<typeof createClient>>;

async function readOwnCard(supabase: Client, userId: string) {
  const { data } = await supabase
    .from("user_settings")
    .select("own_card")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.own_card ?? {};
}

/**
 * Every class across everyone.
 *
 * Reads the table when migration 0019 has been applied, and the fallback blob
 * when it has not, so the feature works either way.
 */
export async function getAllClasses(): Promise<PersonClass[]> {
  const user = await getAuthenticatedUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("person_classes")
    .select("*")
    .eq("user_id", user.id)
    .order("course_code");

  if (!error && data) return (data as ClassRow[]).map(mapClass);
  if (!isMissingSchema(error)) return [];

  const byPerson = readFallback(await readOwnCard(supabase, user.id)).classes ?? {};
  return Object.values(byPerson)
    .flat()
    .sort((left, right) => left.courseCode.localeCompare(right.courseCode));
}

export async function addClassForUser(
  userId: string,
  input: Omit<PersonClass, "id">,
): Promise<PersonClass | { error: string }> {
  const supabase = await createClient();
  const courseCode = normalizeCourseCode(input.courseCode);

  const { data, error } = await supabase
    .from("person_classes")
    .insert({
      user_id: userId,
      person_id: input.personId,
      course_code: courseCode,
      course_title: input.courseTitle,
      professor: input.professor,
      term: input.term,
      days: input.days,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      location: input.location,
    })
    .select("*")
    .single();

  if (!error && data) return mapClass(data as ClassRow);
  if (!isMissingSchema(error)) return { error: error?.message ?? "It could not be saved." };

  const ownCard = await readOwnCard(supabase, userId);
  const classes = readFallback(ownCard).classes ?? {};
  const entry: PersonClass = { ...input, courseCode, id: randomUUID() };
  const next = {
    ...classes,
    [input.personId]: [...(classes[input.personId] ?? []), entry],
  };

  const { error: writeError } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, own_card: writeFallback(ownCard, { classes: next }) },
      { onConflict: "user_id" },
    );

  if (writeError) return { error: writeError.message };
  return entry;
}

export async function removeClassForUser(userId: string, id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("person_classes")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  if (!error) return null;
  if (!isMissingSchema(error)) return error.message;

  const ownCard = await readOwnCard(supabase, userId);
  const classes = readFallback(ownCard).classes ?? {};
  const next = Object.fromEntries(
    Object.entries(classes).map(([personId, entries]) => [
      personId,
      entries.filter((entry) => entry.id !== id),
    ]),
  );

  const { error: writeError } = await supabase
    .from("user_settings")
    .upsert(
      { user_id: userId, own_card: writeFallback(ownCard, { classes: next }) },
      { onConflict: "user_id" },
    );

  return writeError?.message ?? null;
}

export async function getClassesByPerson(): Promise<Map<string, PersonClass[]>> {
  const classes = await getAllClasses();
  const byPerson = new Map<string, PersonClass[]>();
  for (const entry of classes) {
    const existing = byPerson.get(entry.personId);
    if (existing) existing.push(entry);
    else byPerson.set(entry.personId, [entry]);
  }
  return byPerson;
}
