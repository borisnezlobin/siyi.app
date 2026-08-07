-- Three things that need a column each.
--
-- 1. A default university, so somebody who meets most of their people at one
--    school does not retype it every time.
-- 2. The owner's own contact card, plus a switch that is off until they turn it
--    on. Stored as json because what somebody wants to hand out varies: a dorm
--    and a graduation year for one person, a birthday and an Instagram for the
--    next.
-- 3. Shorter share links. The token used to be exactly 32 characters; a
--    readable link is a name slug and a shorter random tail, so the constraint
--    widens to a range. Existing 32-character tokens still satisfy it.
--
-- Safe to run twice, and safe against a live deployment: every column is added
-- with a default, and the constraint only ever widens.

alter table public.user_settings
  add column if not exists default_university text,
  add column if not exists own_card jsonb not null default '{}'::jsonb,
  add column if not exists own_card_enabled boolean not null default false;

alter table public.person_shares
  drop constraint if exists person_shares_token_check;

alter table public.person_shares
  add constraint person_shares_token_check
  check (token ~ '^[A-Za-z0-9_-]{10,64}$');
