create table public.person_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null check (char_length(trim(text)) between 1 and 2000),
  recorded_at timestamptz not null default now(),
  is_interaction boolean not null default true,
  interaction_label text check (
    interaction_label is null or
    char_length(trim(interaction_label)) between 1 and 60
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.person_update_people (
  update_id uuid not null references public.person_updates(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (update_id, person_id)
);

alter table public.interactions
add column source_update_id uuid references public.person_updates(id) on delete set null;

create index person_updates_user_recorded_idx
  on public.person_updates(user_id, recorded_at desc);
create index person_update_people_person_idx
  on public.person_update_people(person_id, update_id);
create index interactions_source_update_idx
  on public.interactions(source_update_id)
  where source_update_id is not null;

create trigger person_updates_set_updated_at
before update on public.person_updates
for each row execute function public.set_updated_at();

alter table public.person_updates enable row level security;
alter table public.person_update_people enable row level security;

create policy "Updates are visible to their owner"
on public.person_updates for select
using (auth.uid() = user_id);

create policy "Updates can be inserted by their owner"
on public.person_updates for insert
with check (auth.uid() = user_id);

create policy "Updates can be updated by their owner"
on public.person_updates for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Updates can be deleted by their owner"
on public.person_updates for delete
using (auth.uid() = user_id);

create policy "Update people are visible to their owner"
on public.person_update_people for select
using (
  auth.uid() = user_id and
  exists (
    select 1
    from public.person_updates
    where person_updates.id = person_update_people.update_id
      and person_updates.user_id = auth.uid()
  ) and
  exists (
    select 1
    from public.people
    where people.id = person_update_people.person_id
      and people.user_id = auth.uid()
  )
);

create policy "Update people can be inserted by their owner"
on public.person_update_people for insert
with check (
  auth.uid() = user_id and
  exists (
    select 1
    from public.person_updates
    where person_updates.id = person_update_people.update_id
      and person_updates.user_id = auth.uid()
  ) and
  exists (
    select 1
    from public.people
    where people.id = person_update_people.person_id
      and people.user_id = auth.uid()
  )
);

create policy "Update people can be deleted by their owner"
on public.person_update_people for delete
using (auth.uid() = user_id);

create or replace function public.create_person_update(
  person_ids uuid[],
  update_text text,
  recorded_at timestamptz default now(),
  is_interaction boolean default true,
  interaction_label text default 'Talked',
  interaction_kind public.interaction_type default 'other'
)
returns public.person_updates
language plpgsql
security invoker
set search_path = ''
as $$
declare
  authenticated_user_id uuid := auth.uid();
  created_update public.person_updates;
  requested_person_count integer;
  owned_person_count integer;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if coalesce(cardinality(person_ids), 0) < 1 or cardinality(person_ids) > 50 then
    raise exception 'Choose between 1 and 50 people.';
  end if;

  if char_length(trim(update_text)) < 1 or char_length(trim(update_text)) > 2000 then
    raise exception 'Update text must be between 1 and 2000 characters.';
  end if;

  select count(distinct requested_id)
  into requested_person_count
  from unnest(person_ids) as requested_id;

  select count(*)
  into owned_person_count
  from public.people
  where people.id = any(person_ids)
    and people.user_id = authenticated_user_id;

  if owned_person_count <> requested_person_count then
    raise exception 'One or more people are unavailable.';
  end if;

  insert into public.person_updates (
    user_id,
    text,
    recorded_at,
    is_interaction,
    interaction_label
  )
  values (
    authenticated_user_id,
    trim(update_text),
    recorded_at,
    is_interaction,
    case
      when is_interaction then nullif(trim(interaction_label), '')
      else null
    end
  )
  returning * into created_update;

  insert into public.person_update_people (update_id, person_id, user_id)
  select
    created_update.id,
    people.id,
    authenticated_user_id
  from public.people
  where people.id = any(person_ids)
    and people.user_id = authenticated_user_id;

  if is_interaction then
    insert into public.interactions (
      person_id,
      user_id,
      type,
      occurred_at,
      note,
      source_update_id
    )
    select
      people.id,
      authenticated_user_id,
      interaction_kind,
      recorded_at,
      trim(update_text),
      created_update.id
    from public.people
    where people.id = any(person_ids)
      and people.user_id = authenticated_user_id;
  end if;

  return created_update;
end;
$$;

revoke all on function public.create_person_update(
  uuid[],
  text,
  timestamptz,
  boolean,
  text,
  public.interaction_type
) from public;
grant execute on function public.create_person_update(
  uuid[],
  text,
  timestamptz,
  boolean,
  text,
  public.interaction_type
) to authenticated;
