-- The shareable link starts on, and starts with a name and a major on it.
--
-- Only the column defaults change. A default is read when a row is inserted, so
-- this touches nothing that already exists: a profile whose owner left the page
-- off stays off, and one whose owner ticked their own fields keeps exactly those
-- fields. Turning somebody's page on for them would publish their details
-- without them doing anything, which is why there is deliberately no `update`
-- and no `insert` anywhere in this file.
--
-- Safe to run twice.

alter table public.user_profiles
  alter column profile_public set default true;

alter table public.user_profiles
  alter column public_fields set default '{"fullName": true, "major": true}'::jsonb;
