create table if not exists public.native_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  device_id text not null,
  device_name text not null default '',
  app_version text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  last_ticket_id text,
  last_ticket_sent_at timestamptz,
  unique (user_id, expo_push_token),
  unique (user_id, device_id)
);

create index if not exists native_push_subscriptions_active_idx
on public.native_push_subscriptions(user_id)
where revoked_at is null;

drop trigger if exists native_push_subscriptions_set_updated_at
on public.native_push_subscriptions;

create trigger native_push_subscriptions_set_updated_at
before update on public.native_push_subscriptions
for each row execute function public.set_updated_at();

alter table public.native_push_subscriptions enable row level security;

drop policy if exists "Native subscriptions are visible to their owner"
on public.native_push_subscriptions;
create policy "Native subscriptions are visible to their owner"
on public.native_push_subscriptions for select
using (auth.uid() = user_id);

drop policy if exists "Native subscriptions can be inserted by their owner"
on public.native_push_subscriptions;
create policy "Native subscriptions can be inserted by their owner"
on public.native_push_subscriptions for insert
with check (auth.uid() = user_id);

drop policy if exists "Native subscriptions can be updated by their owner"
on public.native_push_subscriptions;
create policy "Native subscriptions can be updated by their owner"
on public.native_push_subscriptions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Native subscriptions can be deleted by their owner"
on public.native_push_subscriptions;
create policy "Native subscriptions can be deleted by their owner"
on public.native_push_subscriptions for delete
using (auth.uid() = user_id);
