import { notFound } from "next/navigation";
import { cache } from "react";
import { createDemoFollowUps, createDemoInteractions, createDemoPeople } from "@/lib/demo-data";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { FollowUp, Interaction, Person, RelationshipStrength, Tag } from "@/lib/types";

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

function mapPerson(row: PersonRow): Person {
  const joinedTags = (row.person_tags ?? []).flatMap(({ tags }) => {
    if (!tags) return [];
    return Array.isArray(tags) ? tags : [tags];
  });

  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    preferredName: row.preferred_name,
    profilePhotoUrl: row.profile_photo_url,
    instagramUsername: row.instagram_username,
    phoneNumber: row.phone_number,
    email: row.email,
    birthday: row.birthday,
    hometown: row.hometown,
    dormOrResidence: row.dorm_or_residence,
    major: row.major,
    graduationYear: row.graduation_year,
    relationshipStrength: row.relationship_strength as RelationshipStrength,
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

  return (data as PersonRow[]).map(mapPerson);
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

  return mapPerson(data as PersonRow);
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
          profilePhotoUrl: row.people.profile_photo_url,
        }
      : undefined,
  }));
}
