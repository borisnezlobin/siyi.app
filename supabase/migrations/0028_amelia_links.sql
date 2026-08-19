-- Amelia is the conversation-capture service (speaker recognition over
-- MongoDB Atlas voiceprints). Siyi never copies its data wholesale; it links
-- a siyi person to an Amelia person by id, and records which conversations
-- have already been imported as person updates so an import cannot run twice.

set lock_timeout = '10s';

create table if not exists public.person_amelia_links (
  person_id uuid primary key references public.people(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amelia_person_id text not null,
  created_at timestamptz not null default now(),
  -- One Amelia speaker maps to at most one siyi person; two links to the same
  -- voice would make every import ambiguous about whose timeline it lands on.
  unique (user_id, amelia_person_id)
);

create index if not exists person_amelia_links_user_idx
  on public.person_amelia_links(user_id);

alter table public.person_amelia_links enable row level security;

drop policy if exists "Amelia links are visible to their owner" on public.person_amelia_links;
create policy "Amelia links are visible to their owner"
  on public.person_amelia_links for select
  using (auth.uid() = user_id);

drop policy if exists "Amelia links are writable by their owner" on public.person_amelia_links;
create policy "Amelia links are writable by their owner"
  on public.person_amelia_links for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.people p
       where p.id = person_id and p.user_id = (select auth.uid())
    )
  );

create table if not exists public.amelia_conversation_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amelia_conversation_id text not null,
  update_id uuid references public.person_updates(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, amelia_conversation_id)
);

alter table public.amelia_conversation_imports enable row level security;

drop policy if exists "Amelia imports are visible to their owner" on public.amelia_conversation_imports;
create policy "Amelia imports are visible to their owner"
  on public.amelia_conversation_imports for select
  using (auth.uid() = user_id);

drop policy if exists "Amelia imports are writable by their owner" on public.amelia_conversation_imports;
create policy "Amelia imports are writable by their owner"
  on public.amelia_conversation_imports for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
