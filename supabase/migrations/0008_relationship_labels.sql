-- The 1-4 strength stays as the reminder cadence key into user_settings.
-- relationship_label is only the human name shown for that relationship.
alter table public.people
add column if not exists relationship_label text check (
  relationship_label is null or
  char_length(trim(relationship_label)) between 1 and 40
);

alter table public.people
add column if not exists reminders_enabled boolean not null default true;

create or replace function public.create_person_with_met_interaction(
  person_data jsonb
)
returns public.people
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_person public.people;
  authenticated_user_id uuid := auth.uid();
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.people (
    user_id,
    full_name,
    preferred_name,
    profile_photo_url,
    instagram_username,
    phone_number,
    email,
    birthday,
    hometown,
    dorm_or_residence,
    major,
    graduation_year,
    relationship_strength,
    relationship_label,
    reminders_enabled,
    reminder_interval_days,
    status,
    first_met_at,
    first_met_location,
    general_notes
  ) values (
    authenticated_user_id,
    person_data ->> 'full_name',
    nullif(person_data ->> 'preferred_name', ''),
    nullif(person_data ->> 'profile_photo_url', ''),
    nullif(
      lower(trim(leading '@' from person_data ->> 'instagram_username')),
      ''
    ),
    nullif(person_data ->> 'phone_number', ''),
    nullif(person_data ->> 'email', ''),
    nullif(person_data ->> 'birthday', '')::date,
    nullif(person_data ->> 'hometown', ''),
    nullif(person_data ->> 'dorm_or_residence', ''),
    nullif(person_data ->> 'major', ''),
    nullif(person_data ->> 'graduation_year', '')::integer,
    coalesce((person_data ->> 'relationship_strength')::smallint, 2),
    nullif(trim(person_data ->> 'relationship_label'), ''),
    coalesce((person_data ->> 'reminders_enabled')::boolean, true),
    nullif(person_data ->> 'reminder_interval_days', '')::integer,
    coalesce(
      (person_data ->> 'status')::public.person_status,
      'active'
    ),
    coalesce((person_data ->> 'first_met_at')::timestamptz, now()),
    nullif(person_data ->> 'first_met_location', ''),
    nullif(person_data ->> 'general_notes', '')
  )
  returning * into created_person;

  insert into public.interactions (
    person_id,
    user_id,
    type,
    occurred_at,
    note
  )
  values (
    created_person.id,
    authenticated_user_id,
    'met',
    created_person.first_met_at,
    created_person.first_met_location
  );

  return created_person;
end;
$$;
