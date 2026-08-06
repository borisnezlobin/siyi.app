create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  body text not null check (char_length(trim(body)) between 1 and 1000),
  segment text not null check (char_length(trim(segment)) between 1 and 60),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- The composer sends a key it generated once, so a double submit lands on the
  -- same row instead of announcing the same thing twice.
  dedupe_key text unique,
  audience_size integer,
  push_sent_at timestamptz,
  push_recipient_count integer,
  push_delivered_count integer,
  push_failed_count integer,
  check (ends_at is null or ends_at > starts_at)
);

create table public.announcement_dismissals (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index announcements_live_idx on public.announcements(starts_at desc);
create index announcement_dismissals_user_idx
  on public.announcement_dismissals(user_id);

alter table public.announcements enable row level security;
alter table public.announcement_dismissals enable row level security;

-- Announcements are broadcast copy, so any signed-in account may read the ones
-- that are currently live. Writing is left to the service role only, which is
-- what the /admin routes use after the allowlist check passes.
create policy "Live announcements are readable by signed-in accounts"
on public.announcements for select
to authenticated
using (
  starts_at <= now() and (ends_at is null or ends_at > now())
);

create policy "Dismissals are visible to their owner"
on public.announcement_dismissals for select
to authenticated
using (auth.uid() = user_id);

create policy "Dismissals can be inserted by their owner"
on public.announcement_dismissals for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Dismissals can be deleted by their owner"
on public.announcement_dismissals for delete
to authenticated
using (auth.uid() = user_id);
