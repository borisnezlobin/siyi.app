-- Several people on one reminder.
--
-- "Feed her cat" is regularly about two people, and a reminder could only ever
-- belong to one. `reminders.person_id` becomes rows in `reminder_people`.
--
-- The old column is dropped in the same migration rather than left nullable
-- beside the join table. A reminder that has both a person_id and a set of
-- rows has two answers to "who is this about", and every reader would have to
-- know which one wins — the compatibility layer this project has said no to.

-- A DDL request that cannot get its lock waits in the queue, and everything
-- behind it waits too. Ten seconds and an error is better than a dashboard tab
-- that says "running" for a quarter of an hour while the table it wants is
-- quietly blocked. Safe to re-run after whatever held the lock has gone.
set lock_timeout = '10s';

create table if not exists public.reminder_people (
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reminder_id, person_id)
);

-- Reminders are read by due date and then resolved to their people, and the
-- profile timeline asks the other way round: every reminder for one person.
create index if not exists reminder_people_person_idx
  on public.reminder_people(person_id);

insert into public.reminder_people (reminder_id, person_id)
select id, person_id
  from public.reminders
 where person_id is not null
on conflict do nothing;

-- Everything below depends on the column, so it has to move before the drop.
--
-- `follow_ups` is the compatibility view left behind when the table was
-- renamed in 0017, whose own note says to drop it once nothing referenced the
-- old name. Nothing does. Being `select *` it would otherwise silently change
-- shape here, which is a worse way to find out it still had users.
drop view if exists public.follow_ups;

-- These three checked that the reminder pointed at a person the caller owns.
-- The reminder no longer names anyone, so that check moves to the table that
-- does: `reminder_people` below refuses a row unless the person is yours. The
-- guarantee is unchanged, it just lives where the person now lives.
drop policy if exists "Follow ups are visible to their owner" on public.reminders;
create policy "Follow ups are visible to their owner"
on public.reminders for select
using (auth.uid() = user_id);

drop policy if exists "Follow ups can be inserted by their owner" on public.reminders;
create policy "Follow ups can be inserted by their owner"
on public.reminders for insert
with check (auth.uid() = user_id);

drop policy if exists "Follow ups can be updated by their owner" on public.reminders;
create policy "Follow ups can be updated by their owner"
on public.reminders for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

alter table public.reminders drop column if exists person_id;

alter table public.reminder_people enable row level security;

-- Ownership lives on the reminder, which already carries user_id, so the join
-- table does not repeat it: a duplicated owner column can disagree with the
-- row it belongs to, and then the policy is guarding the wrong thing.
drop policy if exists "reminder_people are readable by their owner" on public.reminder_people;
create policy "reminder_people are readable by their owner"
  on public.reminder_people for select
  using (
    exists (
      select 1 from public.reminders r
       where r.id = reminder_id and r.user_id = (select auth.uid())
    )
  );

drop policy if exists "reminder_people are writable by their owner" on public.reminder_people;
create policy "reminder_people are writable by their owner"
  on public.reminder_people for all
  using (
    exists (
      select 1 from public.reminders r
       where r.id = reminder_id and r.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.reminders r
       where r.id = reminder_id and r.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.people p
       where p.id = person_id and p.user_id = (select auth.uid())
    )
  );

-- A reminder whose last person is deleted has nobody left to be about, so it
-- goes with them. Deleting one of several only removes that person's row,
-- which the cascade above already does.
create or replace function public.delete_orphaned_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.reminders r
   where r.id = old.reminder_id
     and not exists (
       select 1 from public.reminder_people rp where rp.reminder_id = r.id
     );
  return null;
end;
$$;

drop trigger if exists reminder_people_orphan_cleanup on public.reminder_people;
create trigger reminder_people_orphan_cleanup
  after delete on public.reminder_people
  for each row execute function public.delete_orphaned_reminders();
