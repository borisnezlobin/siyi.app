-- Discord usernames belong alongside phones, emails and Instagram handles: for a
-- lot of people it is the only way they actually talk. The kind column is a check
-- constraint rather than an enum, so widening it is a drop and recreate.
--
-- Safe to run twice: the constraint is dropped only if it exists, and the new one
-- is a superset of the old, so nothing already stored can violate it.

alter table public.person_contact_methods
  drop constraint if exists person_contact_methods_kind_check;

alter table public.person_contact_methods
  add constraint person_contact_methods_kind_check
  check (kind in ('phone', 'email', 'instagram', 'discord'));
