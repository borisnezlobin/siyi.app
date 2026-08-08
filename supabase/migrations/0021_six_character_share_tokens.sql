-- Share tokens are exactly six characters, and the column has to agree.
--
-- Migration 0018 pinned the constraint at ten or more, which was right for the
-- token shape at the time. The app has since moved to six from an alphabet with
-- the confusable characters (i, l, o, 0, 1) removed, so every insert was failing
-- the check and no link could be created at all.
--
-- Six is the only shape now, so anything still in the old shape is dropped
-- rather than grandfathered. Those links are unshared and can be made again.
--
-- Safe to run twice.

alter table public.person_shares
  drop constraint if exists person_shares_token_check;

delete from public.person_shares
  where token !~ '^[a-hjkmnp-zA-HJ-NP-Z2-9]{6}$';

alter table public.person_shares
  add constraint person_shares_token_check
  check (token ~ '^[a-hjkmnp-zA-HJ-NP-Z2-9]{6}$');
