-- Readable person URLs: /people/boris-nezlobin-7fk2
--
-- Every slug carries a random suffix, always, never only on collision. A slug
-- that grew a suffix exactly when the name was already taken would leak across
-- accounts: one user could learn that another user stores a person by that
-- name. The suffix also lets two accounts hold the same name without either
-- one noticing the other.
--
-- Slugs are minted on insert only. Renaming a person keeps the URL they have
-- already shared or bookmarked. The uuid keeps resolving either way.

alter table public.people
add column if not exists slug text;

-- create_person_with_met_interaction is replaced at the end of this file, and
-- the replacement is written against the 0008 shape of the people table. These
-- two additions are copied verbatim from 0008 so that this migration is
-- correct even if it is applied before 0008 is. Both are no-ops afterwards.
alter table public.people
add column if not exists relationship_label text check (
  relationship_label is null or
  char_length(trim(relationship_label)) between 1 and 40
);

alter table public.people
add column if not exists reminders_enabled boolean not null default true;

-- Accents fold to their base letter, everything else outside a-z0-9 becomes a
-- separator, and a name that leaves nothing behind (a non-Latin script, say)
-- falls back to a word rather than to a bare suffix.
create or replace function public.slugify_person_name(source text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      regexp_replace(
        left(
          trim(both '-' from
            regexp_replace(
              regexp_replace(
                lower(normalize(coalesce(source, ''), nfkd)),
                U&'[\0300-\036F]',
                '',
                'g'
              ),
              '[^a-z0-9]+',
              '-',
              'g'
            )
          ),
          48
        ),
        '-+$',
        ''
      ),
      ''
    ),
    'person'
  );
$$;

-- Digits and consonants only: no vowels, so a suffix cannot read as a word,
-- and no characters that are easy to confuse (0/o, 1/l/i, 5/s). The bytes come
-- from gen_random_uuid(), which is seeded from the platform CSPRNG.
create or replace function public.person_slug_suffix()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr(
      '23456789bcdfghjkmnpqrstvwxz',
      (get_byte(random_bytes, byte_index) % 27) + 1,
      1
    ),
    ''
    order by byte_index
  )
  from (
    select decode(replace(gen_random_uuid()::text, '-', ''), 'hex') as random_bytes
  ) as source,
  generate_series(0, 3) as byte_index;
$$;

-- A caller may propose a slug (the web app mints one so it can be shown right
-- away). Anything malformed or already taken by this same user is replaced.
create or replace function public.unique_person_slug(
  owner_id uuid,
  source_name text,
  proposed text default null
)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  base text := public.slugify_person_name(source_name);
  candidate text := nullif(trim(coalesce(proposed, '')), '');
  attempts integer := 0;
begin
  if candidate is not null and candidate !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    candidate := null;
  end if;
  if candidate is not null and char_length(candidate) > 80 then
    candidate := null;
  end if;

  loop
    if candidate is not null and not exists (
      select 1
      from public.people
      where people.user_id = owner_id
        and people.slug = candidate
    ) then
      return candidate;
    end if;

    attempts := attempts + 1;
    if attempts > 20 then
      return base || '-' || replace(gen_random_uuid()::text, '-', '');
    end if;

    candidate := base || '-' || public.person_slug_suffix();
  end loop;
end;
$$;

create or replace function public.assign_person_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.slug := public.unique_person_slug(new.user_id, new.full_name, new.slug);
  return new;
end;
$$;

drop trigger if exists people_assign_slug on public.people;
create trigger people_assign_slug
before insert on public.people
for each row execute function public.assign_person_slug();

-- Two accounts may hold the same slug; within one account it is unique.
create unique index if not exists people_user_slug_idx
on public.people(user_id, slug)
where slug is not null;

-- Backfill. The updated_at trigger stays off for the duration so no other
-- column moves, and "last updated" keeps meaning what it meant this morning.
alter table public.people disable trigger people_set_updated_at;

do $$
declare
  person record;
begin
  for person in
    select id, user_id, full_name
    from public.people
    where slug is null
    order by created_at
  loop
    update public.people
    set slug = public.unique_person_slug(person.user_id, person.full_name)
    where id = person.id;
  end loop;
end;
$$;

alter table public.people enable trigger people_set_updated_at;

-- Creating a person goes through this function, so it has to carry the slug
-- the app proposes. Everything else about it is unchanged.
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
    general_notes,
    slug
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
    nullif(person_data ->> 'general_notes', ''),
    nullif(person_data ->> 'slug', '')
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
