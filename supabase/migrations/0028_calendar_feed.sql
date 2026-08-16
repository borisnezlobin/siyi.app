-- A subscribable calendar feed, so birthdays and reminders show up in Google
-- Calendar, Apple Calendar or Outlook next to everything else.
--
-- A calendar client subscribes once and then fetches on its own schedule, with
-- no cookie and no way to sign in, so the URL is the credential: 32 random
-- characters, and the feed is off until the user asks for one. Turning it off
-- clears the token, and resetting it writes a new one — both of which break
-- every subscription that had the old URL, which is the point.
--
-- Safe to run twice.

alter table public.user_profiles
  add column if not exists calendar_token text;

alter table public.user_profiles
  drop constraint if exists user_profiles_calendar_token_check;

alter table public.user_profiles
  add constraint user_profiles_calendar_token_check
  check (calendar_token is null or calendar_token ~ '^[A-Za-z0-9_-]{32}$');

create unique index if not exists user_profiles_calendar_token_key
  on public.user_profiles (calendar_token)
  where calendar_token is not null;
