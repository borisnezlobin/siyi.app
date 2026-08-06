-- Several phones, emails and Instagram handles per person.
--
-- Additive only. people.phone_number, people.email and people.instagram_username
-- stay exactly where they are and keep holding the primary of each kind, because
-- vCard export, contact sync, search, CSV export and the phone app all read
-- them. They become a denormalised cache of the primary; dropping them is a
-- separate job for a later migration, once every reader has moved across.

create table if not exists public.person_contact_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  kind text not null check (kind in ('phone', 'email', 'instagram')),
  value text not null check (char_length(trim(value)) between 1 and 200),
  label text check (char_length(label) <= 40),
  position integer not null default 0 check (position >= 0),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reading everything for one person is the hot path: the detail page, the edit
-- page and the share sheet all ask this question.
create index if not exists person_contact_methods_person_idx
  on public.person_contact_methods(person_id, kind, position, created_at);

-- Looking a person up by a number or address they gave you.
create index if not exists person_contact_methods_user_value_idx
  on public.person_contact_methods(user_id, kind, value);

drop trigger if exists person_contact_methods_set_updated_at
  on public.person_contact_methods;
create trigger person_contact_methods_set_updated_at
before update on public.person_contact_methods
for each row execute function public.set_updated_at();

alter table public.person_contact_methods enable row level security;

drop policy if exists "Contact methods are visible to their owner"
  on public.person_contact_methods;
create policy "Contact methods are visible to their owner"
on public.person_contact_methods for select
using (auth.uid() = user_id);

drop policy if exists "Contact methods can be inserted by their owner"
  on public.person_contact_methods;
create policy "Contact methods can be inserted by their owner"
on public.person_contact_methods for insert
with check (
  auth.uid() = user_id and
  exists (
    select 1
    from public.people
    where people.id = person_contact_methods.person_id
      and people.user_id = auth.uid()
  )
);

drop policy if exists "Contact methods can be updated by their owner"
  on public.person_contact_methods;
create policy "Contact methods can be updated by their owner"
on public.person_contact_methods for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Contact methods can be deleted by their owner"
  on public.person_contact_methods;
create policy "Contact methods can be deleted by their owner"
on public.person_contact_methods for delete
using (auth.uid() = user_id);

-- Backfill. Each existing column becomes the primary of its kind. The
-- "not exists" guard is per person and per kind, so running this file twice
-- adds nothing the second time, and it never disturbs rows someone has already
-- added through the app.

insert into public.person_contact_methods
  (user_id, person_id, kind, value, is_primary, position)
select people.user_id, people.id, 'phone', trim(people.phone_number), true, 0
from public.people
where people.phone_number is not null
  and trim(people.phone_number) <> ''
  and not exists (
    select 1
    from public.person_contact_methods existing
    where existing.person_id = people.id
      and existing.kind = 'phone'
  );

insert into public.person_contact_methods
  (user_id, person_id, kind, value, is_primary, position)
select people.user_id, people.id, 'email', trim(people.email), true, 0
from public.people
where people.email is not null
  and trim(people.email) <> ''
  and not exists (
    select 1
    from public.person_contact_methods existing
    where existing.person_id = people.id
      and existing.kind = 'email'
  );

insert into public.person_contact_methods
  (user_id, person_id, kind, value, is_primary, position)
select
  people.user_id,
  people.id,
  'instagram',
  trim(leading '@' from trim(people.instagram_username)),
  true,
  0
from public.people
where people.instagram_username is not null
  and trim(leading '@' from trim(people.instagram_username)) <> ''
  and not exists (
    select 1
    from public.person_contact_methods existing
    where existing.person_id = people.id
      and existing.kind = 'instagram'
  );
