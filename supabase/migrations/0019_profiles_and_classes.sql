-- Public profiles and classes.
--
-- A handle is a name plus a short tag ("boris.nezlobin#4f21"), the way Discord
-- used to do it. The tag exists so a handle cannot be guessed from a name: the
-- page is readable by anyone holding the full address, and enumerating names
-- alone should not find anybody.
--
-- Nothing on a profile is public by default. `public_fields` lists what the
-- owner has deliberately turned on, and the page shows only those.
--
-- Classes belong to a person, not to a school: no university exposes a course
-- API that works across institutions, so these are typed in and reused. That
-- also means they work everywhere on the first day rather than at one campus.
--
-- Safe to run twice, and against a live deployment: every column has a default
-- and every policy is dropped before it is recreated.

alter table public.user_profiles
  add column if not exists handle text,
  add column if not exists handle_tag text,
  add column if not exists profile_public boolean not null default false,
  add column if not exists public_fields jsonb not null default '{}'::jsonb;

-- Case-insensitive, because nobody remembers how they capitalised it.
create unique index if not exists user_profiles_handle_idx
  on public.user_profiles (lower(handle), handle_tag)
  where handle is not null;

create table if not exists public.person_classes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  course_code text not null check (char_length(course_code) between 1 and 40),
  course_title text check (char_length(course_title) <= 120),
  professor text check (char_length(professor) <= 80),
  term text check (char_length(term) <= 40),
  -- The days a class meets, as single letters: "MWF", "TuTh".
  days text check (char_length(days) <= 14),
  starts_at time,
  ends_at time,
  location text check (char_length(location) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists person_classes_person_idx
  on public.person_classes(person_id);

create index if not exists person_classes_user_course_idx
  on public.person_classes(user_id, course_code);

alter table public.person_classes enable row level security;

drop policy if exists "Classes are visible to their owner" on public.person_classes;
create policy "Classes are visible to their owner"
on public.person_classes for select
using (auth.uid() = user_id);

drop policy if exists "Classes can be created by their owner" on public.person_classes;
create policy "Classes can be created by their owner"
on public.person_classes for insert
with check (
  auth.uid() = user_id and
  exists (
    select 1
    from public.people
    where people.id = person_classes.person_id
      and people.user_id = auth.uid()
  )
);

drop policy if exists "Classes can be updated by their owner" on public.person_classes;
create policy "Classes can be updated by their owner"
on public.person_classes for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Classes can be deleted by their owner" on public.person_classes;
create policy "Classes can be deleted by their owner"
on public.person_classes for delete
using (auth.uid() = user_id);
