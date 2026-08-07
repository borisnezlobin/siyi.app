import { getAuthenticatedUser } from "@/lib/auth";
import { normalizeCourseCode, type PersonClass } from "@/lib/classes";
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

/** Every class across everyone. */
export async function getAllClasses(): Promise<PersonClass[]> {
  const user = await getAuthenticatedUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("person_classes")
    .select("*")
    .eq("user_id", user.id)
    .order("course_code");

  if (error || !data) return [];
  return (data as ClassRow[]).map(mapClass);
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

  if (error || !data) return { error: error?.message ?? "It could not be saved." };
  return mapClass(data as ClassRow);
}

export async function removeClassForUser(userId: string, id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("person_classes")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);

  return error?.message ?? null;
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
