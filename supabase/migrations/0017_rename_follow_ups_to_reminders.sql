-- Finishes the rename in the database. Safe to run against a live deployment:
-- the old name survives as an updatable view, so code still saying follow_ups
-- keeps working and can be switched over afterwards rather than in lockstep.
--
-- A view over a single table with no aggregates is updatable in Postgres, so
-- inserts, updates and deletes through public.follow_ups continue to land in the
-- renamed table. Drop the view once nothing references the old name.
--
-- Not applied automatically: renaming a live table under a running deployment is
-- the owner's call, not a script's.

alter table if exists public.follow_ups rename to reminders;

-- notification_preferences.follow_up_enabled is deliberately left alone. A view
-- can stand in for a renamed table, but not for a renamed column on a table the
-- apps write to directly, so that one has to move together with its code.

create or replace view public.follow_ups as
  select * from public.reminders;

grant select, insert, update, delete on public.follow_ups to authenticated;
