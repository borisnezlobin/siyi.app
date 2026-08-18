import type { PersonClass } from "@/lib/classes";
import { normalizeCourseCode } from "@/lib/classes";
import { markStale } from "@/lib/query-cache";
import { supabase } from "@/lib/supabase";

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

/** Empty rather than throwing when migration 0019 has not run yet. */
export async function getClasses(userId: string): Promise<PersonClass[]> {
  const { data, error } = await supabase
    .from("person_classes")
    .select("*")
    .eq("user_id", userId)
    .order("course_code");

  if (error || !data) return [];
  return (data as ClassRow[]).map(mapClass);
}

/**
 * The screens that show classes, and would otherwise keep the old list.
 *
 * Written out rather than imported from `screen-queries`, which is where
 * `peopleTabQueryKey` lives: that module imports this one, and closing the loop
 * risks one of the two seeing the other half-initialised. If these keys move,
 * they move together.
 */
function markClassesStale() {
  for (const key of ["classes", "peopleTab"]) markStale(key);
}

export async function addClass(
  userId: string,
  input: Omit<PersonClass, "id"> & { personId: string },
) {
  const { data, error } = await supabase
    .from("person_classes")
    .insert({
      user_id: userId,
      person_id: input.personId,
      course_code: normalizeCourseCode(input.courseCode),
      course_title: input.courseTitle || null,
      professor: input.professor || null,
      term: input.term || null,
      days: input.days || null,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
      location: input.location || null,
    })
    .select("*")
    .single();

  if (error) throw error;
  // The classes screen and the People tab both read this, and neither is fed by
  // the offline snapshot the way people and reminders are — so without saying
  // so here, nothing knew the list had changed and a class added to somebody
  // was missing from the filters until the fifteen-second freshness window
  // happened to lapse.
  markClassesStale();
  return mapClass(data as ClassRow);
}

export async function removeClass(userId: string, id: string) {
  const { error } = await supabase
    .from("person_classes")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
  markClassesStale();
}
