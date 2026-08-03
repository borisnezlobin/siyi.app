create extension if not exists pgcrypto;

create type public.person_status as enum ('active', 'muted', 'archived');
create type public.interaction_type as enum (
  'met', 'texted', 'called', 'coffee', 'meal', 'party', 'class', 'event', 'other'
);
create type public.notification_delivery_status as enum (
  'pending', 'delivered', 'failed', 'skipped'
);

create table public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default '',
  email text not null default '',
  avatar_url text,
  timezone text not null default 'UTC',
  locale text not null default 'en-US',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  strength_1_days integer not null default 90 check (strength_1_days between 1 and 3650),
  strength_2_days integer not null default 45 check (strength_2_days between 1 and 3650),
  strength_3_days integer not null default 30 check (strength_3_days between 1 and 3650),
  strength_4_days integer not null default 14 check (strength_4_days between 1 and 3650),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  preferred_name text,
  profile_photo_url text,
  instagram_username text,
  phone_number text,
  email text,
  birthday date,
  hometown text,
  dorm_or_residence text,
  major text,
  graduation_year integer check (graduation_year between 1900 and 2200),
  relationship_strength smallint not null default 2 check (relationship_strength between 1 and 4),
  reminder_interval_days integer check (reminder_interval_days between 1 and 3650),
  status public.person_status not null default 'active',
  first_met_at timestamptz not null default now(),
  first_met_location text,
  general_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.interactions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.interaction_type not null,
  occurred_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.person_tags (
  person_id uuid not null references public.people(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (person_id, tag_id)
);

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  due_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  unique (user_id, endpoint)
);

create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  push_enabled boolean not null default false,
  overdue_contact_enabled boolean not null default true,
  birthday_enabled boolean not null default true,
  follow_up_enabled boolean not null default true,
  reminder_hour_local smallint not null default 10 check (reminder_hour_local between 0 and 23),
  reminder_days_of_week smallint[] not null default '{1,2,3,4,5}'::smallint[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    reminder_days_of_week <@ array[0,1,2,3,4,5,6]::smallint[]
  )
);

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  related_entity_id uuid,
  scheduled_for timestamptz not null,
  delivered_at timestamptz,
  status public.notification_delivery_status not null default 'pending',
  failure_reason text,
  deduplication_key text not null unique,
  created_at timestamptz not null default now()
);

create index people_user_id_idx on public.people(user_id);
create index people_user_search_idx on public.people using gin (
  to_tsvector(
    'simple',
    coalesce(full_name, '') || ' ' ||
    coalesce(instagram_username, '') || ' ' ||
    coalesce(phone_number, '') || ' ' ||
    coalesce(general_notes, '') || ' ' ||
    coalesce(major, '') || ' ' ||
    coalesce(dorm_or_residence, '')
  )
);
create index interactions_person_occurred_idx
  on public.interactions(person_id, occurred_at desc);
create index interactions_user_id_idx on public.interactions(user_id);
create index follow_ups_user_due_idx
  on public.follow_ups(user_id, completed_at, due_at);
create index notification_deliveries_pending_idx
  on public.notification_deliveries(status, scheduled_for)
  where status = 'pending';
create index push_subscriptions_active_idx
  on public.push_subscriptions(user_id)
  where revoked_at is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function public.set_updated_at();
create trigger user_settings_set_updated_at
before update on public.user_settings
for each row execute function public.set_updated_at();
create trigger people_set_updated_at
before update on public.people
for each row execute function public.set_updated_at();
create trigger interactions_set_updated_at
before update on public.interactions
for each row execute function public.set_updated_at();
create trigger follow_ups_set_updated_at
before update on public.follow_ups
for each row execute function public.set_updated_at();
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (auth_user_id, display_name, email)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ),
    coalesce(new.email, '')
  );
  insert into public.user_settings (user_id) values (new.id);
  insert into public.notification_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

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

alter table public.user_profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.people enable row level security;
alter table public.interactions enable row level security;
alter table public.tags enable row level security;
alter table public.person_tags enable row level security;
alter table public.follow_ups enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_deliveries enable row level security;

create policy "Profiles are visible to their owner"
on public.user_profiles for select
using (auth.uid() = auth_user_id);
create policy "Profiles can be inserted by their owner"
on public.user_profiles for insert
with check (auth.uid() = auth_user_id);
create policy "Profiles can be updated by their owner"
on public.user_profiles for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);
create policy "Profiles can be deleted by their owner"
on public.user_profiles for delete
using (auth.uid() = auth_user_id);

create policy "Settings are visible to their owner"
on public.user_settings for select
using (auth.uid() = user_id);
create policy "Settings can be inserted by their owner"
on public.user_settings for insert
with check (auth.uid() = user_id);
create policy "Settings can be updated by their owner"
on public.user_settings for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create policy "Settings can be deleted by their owner"
on public.user_settings for delete
using (auth.uid() = user_id);

create policy "People are visible to their owner"
on public.people for select
using (auth.uid() = user_id);
create policy "People can be inserted by their owner"
on public.people for insert
with check (auth.uid() = user_id);
create policy "People can be updated by their owner"
on public.people for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create policy "People can be deleted by their owner"
on public.people for delete
using (auth.uid() = user_id);

create policy "Interactions are visible to their owner"
on public.interactions for select
using (
  auth.uid() = user_id and
  exists (
    select 1
    from public.people
    where people.id = interactions.person_id
      and people.user_id = auth.uid()
  )
);
create policy "Interactions can be inserted by their owner"
on public.interactions for insert
with check (
  auth.uid() = user_id and
  exists (
    select 1
    from public.people
    where people.id = interactions.person_id
      and people.user_id = auth.uid()
  )
);
create policy "Interactions can be updated by their owner"
on public.interactions for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id and
  exists (
    select 1
    from public.people
    where people.id = interactions.person_id
      and people.user_id = auth.uid()
  )
);
create policy "Interactions can be deleted by their owner"
on public.interactions for delete
using (auth.uid() = user_id);

create policy "Tags are visible to their owner"
on public.tags for select
using (auth.uid() = user_id);
create policy "Tags can be inserted by their owner"
on public.tags for insert
with check (auth.uid() = user_id);
create policy "Tags can be updated by their owner"
on public.tags for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create policy "Tags can be deleted by their owner"
on public.tags for delete
using (auth.uid() = user_id);

create policy "Person tags are visible to their owner"
on public.person_tags for select
using (
  exists (
    select 1
    from public.people
    where people.id = person_tags.person_id
      and people.user_id = auth.uid()
  )
);
create policy "Person tags can be inserted by their owner"
on public.person_tags for insert
with check (
  exists (
    select 1
    from public.people
    where people.id = person_tags.person_id
      and people.user_id = auth.uid()
  ) and
  exists (
    select 1
    from public.tags
    where tags.id = person_tags.tag_id
      and tags.user_id = auth.uid()
  )
);
create policy "Person tags can be deleted by their owner"
on public.person_tags for delete
using (
  exists (
    select 1
    from public.people
    where people.id = person_tags.person_id
      and people.user_id = auth.uid()
  )
);

create policy "Follow ups are visible to their owner"
on public.follow_ups for select
using (
  auth.uid() = user_id and
  exists (
    select 1
    from public.people
    where people.id = follow_ups.person_id
      and people.user_id = auth.uid()
  )
);
create policy "Follow ups can be inserted by their owner"
on public.follow_ups for insert
with check (
  auth.uid() = user_id and
  exists (
    select 1
    from public.people
    where people.id = follow_ups.person_id
      and people.user_id = auth.uid()
  )
);
create policy "Follow ups can be updated by their owner"
on public.follow_ups for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id and
  exists (
    select 1
    from public.people
    where people.id = follow_ups.person_id
      and people.user_id = auth.uid()
  )
);
create policy "Follow ups can be deleted by their owner"
on public.follow_ups for delete
using (auth.uid() = user_id);

create policy "Push subscriptions are visible to their owner"
on public.push_subscriptions for select
using (auth.uid() = user_id);
create policy "Push subscriptions can be inserted by their owner"
on public.push_subscriptions for insert
with check (auth.uid() = user_id);
create policy "Push subscriptions can be updated by their owner"
on public.push_subscriptions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create policy "Push subscriptions can be deleted by their owner"
on public.push_subscriptions for delete
using (auth.uid() = user_id);

create policy "Notification preferences are visible to their owner"
on public.notification_preferences for select
using (auth.uid() = user_id);
create policy "Notification preferences can be inserted by their owner"
on public.notification_preferences for insert
with check (auth.uid() = user_id);
create policy "Notification preferences can be updated by their owner"
on public.notification_preferences for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
create policy "Notification preferences can be deleted by their owner"
on public.notification_preferences for delete
using (auth.uid() = user_id);

create policy "Notification deliveries are visible to their owner"
on public.notification_deliveries for select
using (auth.uid() = user_id);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Avatar images are publicly readable"
on storage.objects for select
using (bucket_id = 'avatars');
create policy "Users can upload avatars to their folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars' and
  (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Users can update avatars in their folder"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars' and
  (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars' and
  (storage.foldername(name))[1] = auth.uid()::text
);
create policy "Users can delete avatars in their folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars' and
  (storage.foldername(name))[1] = auth.uid()::text
);
