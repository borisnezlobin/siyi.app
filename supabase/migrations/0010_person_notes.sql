-- Named note sections, so the headings people already reuse by hand
-- ("Interests", "Things we've done together") become real, orderable blocks.
-- Additive only: people.general_notes stays exactly as it is and keeps
-- rendering as the untitled first section.

create table if not exists public.person_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  heading text not null check (char_length(trim(heading)) between 1 and 60),
  body text not null default '' check (char_length(body) <= 4000),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists person_notes_person_position_idx
  on public.person_notes(person_id, position, created_at);

create index if not exists person_notes_user_heading_idx
  on public.person_notes(user_id, heading);

drop trigger if exists person_notes_set_updated_at on public.person_notes;
create trigger person_notes_set_updated_at
before update on public.person_notes
for each row execute function public.set_updated_at();

alter table public.person_notes enable row level security;

drop policy if exists "Person notes are visible to their owner" on public.person_notes;
create policy "Person notes are visible to their owner"
on public.person_notes for select
using (auth.uid() = user_id);

drop policy if exists "Person notes can be inserted by their owner" on public.person_notes;
create policy "Person notes can be inserted by their owner"
on public.person_notes for insert
with check (
  auth.uid() = user_id and
  exists (
    select 1
    from public.people
    where people.id = person_notes.person_id
      and people.user_id = auth.uid()
  )
);

drop policy if exists "Person notes can be updated by their owner" on public.person_notes;
create policy "Person notes can be updated by their owner"
on public.person_notes for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Person notes can be deleted by their owner" on public.person_notes;
create policy "Person notes can be deleted by their owner"
on public.person_notes for delete
using (auth.uid() = user_id);
