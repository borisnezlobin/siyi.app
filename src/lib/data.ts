import { notFound } from "next/navigation";
import { cache } from "react";
import { createDemoFollowUps, createDemoInteractions, createDemoPeople } from "@/lib/demo-data";
import { resolveAvatarUrls, resolvedAvatarUrl } from "@/lib/avatar-urls";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { orderedNoteSections } from "@/lib/note-sections";
import type {
  FollowUp,
  Interaction,
  Person,
  PersonNote,
  PersonNoteSections,
  PersonUpdate,
  RelationshipStrength,
  Tag,
} from "@/lib/types";

type PersonRow = {
  id: string;
  user_id: string;
  full_name: string;
  preferred_name: string | null;
  profile_photo_url: string | null;
  instagram_username: string | null;
  phone_number: string | null;
  email: string | null;
  birthday: string | null;
  hometown: string | null;
  dorm_or_residence: string | null;
  major: string | null;
  graduation_year: number | null;
  relationship_strength: number;
  relationship_label: string | null;
  reminders_enabled: boolean | null;
  reminder_interval_days: number | null;
  status: "active" | "muted" | "archived";
  first_met_at: string;
  first_met_location: string | null;
  general_notes: string | null;
  created_at: string;
  updated_at: string;
  interactions?: { occurred_at: string }[];
  person_tags?: { tags: TagRow | TagRow[] | null }[];
};

type TagRow = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

function mapTag(row: TagRow): Tag {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    createdAt: row.created_at,
  };
}

function mapPerson(row: PersonRow, profilePhotoUrl = row.profile_photo_url): Person {
  const joinedTags = (row.person_tags ?? []).flatMap(({ tags }) => {
    if (!tags) return [];
    return Array.isArray(tags) ? tags : [tags];
  });

  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    preferredName: row.preferred_name,
    profilePhotoUrl,
    instagramUsername: row.instagram_username,
    phoneNumber: row.phone_number,
    email: row.email,
    birthday: row.birthday,
    hometown: row.hometown,
    dormOrResidence: row.dorm_or_residence,
    major: row.major,
    graduationYear: row.graduation_year,
    relationshipStrength: row.relationship_strength as RelationshipStrength,
    relationshipLabel: row.relationship_label ?? null,
    remindersEnabled: row.reminders_enabled ?? true,
    reminderIntervalDays: row.reminder_interval_days,
    status: row.status,
    firstMetAt: row.first_met_at,
    firstMetLocation: row.first_met_location,
    generalNotes: row.general_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastInteractionAt: row.interactions?.[0]?.occurred_at ?? null,
    tags: joinedTags.map(mapTag),
  };
}

const loadPeople = async (): Promise<Person[]> => {
  if (!isSupabaseConfigured()) {
    return createDemoPeople();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select(
      "*, interactions(occurred_at), person_tags(tags(id,user_id,name,created_at))",
    )
    .order("created_at", { ascending: false })
    .order("occurred_at", {
      referencedTable: "interactions",
      ascending: false,
    })
    .limit(1, { referencedTable: "interactions" });

  if (error) {
    throw new Error(error.message);
  }

  const rows = data as PersonRow[];
  const avatarUrls = await resolveAvatarUrls(
    supabase,
    rows.map((row) => row.profile_photo_url),
  );

  return rows.map((row) =>
    mapPerson(
      row,
      resolvedAvatarUrl(row.profile_photo_url, avatarUrls),
    ),
  );
};

export const getPeople = cache(loadPeople);

export async function getPerson(personId: string): Promise<Person> {
  if (!isSupabaseConfigured()) {
    const person = createDemoPeople().find(({ id }) => id === personId);
    if (!person) notFound();
    return person;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select(
      "*, interactions(occurred_at), person_tags(tags(id,user_id,name,created_at))",
    )
    .eq("id", personId)
    .order("occurred_at", {
      referencedTable: "interactions",
      ascending: false,
    })
    .limit(1, { referencedTable: "interactions" })
    .single();

  if (error || !data) {
    notFound();
  }

  const row = data as PersonRow;
  const avatarUrls = await resolveAvatarUrls(supabase, [row.profile_photo_url]);
  return mapPerson(
    row,
    resolvedAvatarUrl(row.profile_photo_url, avatarUrls),
  );
}

/** Older deployments may not have the person_updates tables yet. */
function isMissingUpdatesSchema(code: string | undefined) {
  return ["42P01", "42883", "PGRST202", "PGRST205"].includes(code || "");
}

export async function getPersonUpdates(
  personId: string,
): Promise<PersonUpdate[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("person_updates")
    .select("*, person_update_people!inner(person_id)")
    .eq("person_update_people.person_id", personId)
    .order("recorded_at", { ascending: false });

  if (error) {
    if (isMissingUpdatesSchema(error.code)) return [];
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    text: row.text,
    recordedAt: row.recorded_at,
    isInteraction: row.is_interaction,
    interactionLabel: row.interaction_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    personIds: (row.person_update_people ?? []).map(
      (link: { person_id: string }) => link.person_id,
    ),
  }));
}

function mapPersonNote(row: {
  id: string;
  person_id: string;
  user_id: string;
  heading: string;
  body: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}): PersonNote {
  return {
    id: row.id,
    personId: row.person_id,
    userId: row.user_id,
    heading: row.heading,
    body: row.body ?? "",
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Named note sections for one person. Reports itself unavailable rather than
 * throwing when migration 0010 has not been applied yet.
 */
export async function getPersonNoteSections(
  personId: string,
): Promise<PersonNoteSections> {
  if (!isSupabaseConfigured()) return { available: false, sections: [] };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("person_notes")
    .select("*")
    .eq("person_id", personId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    if (isMissingUpdatesSchema(error.code) || error.code === "42703") {
      return { available: false, sections: [] };
    }
    throw new Error(error.message);
  }

  return {
    available: true,
    sections: orderedNoteSections((data ?? []).map(mapPersonNote)),
  };
}

/**
 * The headings this user has already written on other people, newest first,
 * so adding a section is a tap instead of retyping "Interests" again.
 * Returns nothing until migration 0010 has run.
 */
export async function getUsedNoteHeadings(limit = 40): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("person_notes")
    .select("heading,updated_at")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) {
    if (isMissingUpdatesSchema(error.code) || error.code === "42703") return [];
    throw new Error(error.message);
  }

  const seen: string[] = [];
  for (const row of data ?? []) {
    const heading = (row.heading as string | null)?.trim();
    if (!heading) continue;
    const alreadySeen = seen.some(
      (existing) => existing.toLowerCase() === heading.toLowerCase(),
    );
    if (!alreadySeen) seen.push(heading);
    if (seen.length === limit) break;
  }
  return seen;
}

export async function getInteractions(personId?: string): Promise<Interaction[]> {
  if (!isSupabaseConfigured()) {
    return createDemoInteractions().filter(
      (interaction) => !personId || interaction.personId === personId,
    );
  }

  const supabase = await createClient();
  let query = supabase
    .from("interactions")
    .select("*")
    .order("occurred_at", { ascending: false });

  if (personId) {
    query = query.eq("person_id", personId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return data.map((row) => ({
    id: row.id,
    personId: row.person_id,
    userId: row.user_id,
    type: row.type,
    occurredAt: row.occurred_at,
    note: row.note,
    customLabel: row.custom_label ?? null,
    customIcon: row.custom_icon ?? null,
    sourceUpdateId: row.source_update_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function getFollowUps(): Promise<FollowUp[]> {
  if (!isSupabaseConfigured()) {
    return createDemoFollowUps();
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select("*, people(id,full_name,preferred_name,profile_photo_url)")
    .order("due_at", { ascending: true });

  if (error) throw new Error(error.message);
  const avatarUrls = await resolveAvatarUrls(
    supabase,
    data.map((row) => row.people?.profile_photo_url),
  );

  return data.map((row) => ({
    id: row.id,
    personId: row.person_id,
    userId: row.user_id,
    text: row.text,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    person: row.people
      ? {
          id: row.people.id,
          fullName: row.people.full_name,
          preferredName: row.people.preferred_name,
          profilePhotoUrl: resolvedAvatarUrl(
            row.people.profile_photo_url,
            avatarUrls,
          ),
        }
      : undefined,
  }));
}

/**
 * Offers back the names this user has already invented, so a recurring "Went
 * bouldering" is one tap rather than retyped. Returns nothing until migration
 * 0009 has run.
 */
export async function getRecentCustomLabels(limit = 6): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("interactions")
    .select("custom_label,occurred_at")
    .not("custom_label", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(60);

  if (error) {
    if (isMissingUpdatesSchema(error.code) || error.code === "42703") return [];
    throw new Error(error.message);
  }

  const seen: string[] = [];
  for (const row of data ?? []) {
    const label = (row.custom_label as string | null)?.trim();
    if (label && !seen.includes(label)) seen.push(label);
    if (seen.length === limit) break;
  }
  return seen;
}
