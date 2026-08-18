-- Signing in with Google or Apple never passes through a signup form, so those
-- accounts were never asked about email. `marketing_opt_in = false` cannot
-- answer "were they asked and said no, or never asked at all", which is the
-- difference between showing the question once and showing it forever.

alter table public.user_profiles
add column if not exists marketing_prompted_at timestamptz;

-- Everyone who already has an account has already been past the signup form,
-- so none of them is asked again.
update public.user_profiles
set marketing_prompted_at = coalesce(marketing_opt_in_at, created_at)
where marketing_prompted_at is null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  consented boolean;
  asked boolean;
begin
  -- The signup form always sends the key, checked or not. A provider sign-in
  -- sends no metadata at all, which is exactly the case that still owes the
  -- person a question.
  asked := new.raw_user_meta_data ? 'marketing_opt_in';
  consented := coalesce(
    (new.raw_user_meta_data ->> 'marketing_opt_in')::boolean,
    false
  );

  insert into public.user_profiles (
    auth_user_id,
    display_name,
    email,
    marketing_opt_in,
    marketing_opt_in_at,
    marketing_prompted_at
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ),
    coalesce(new.email, ''),
    consented,
    case when consented then now() else null end,
    case when asked then now() else null end
  )
  -- Only the email is refreshed for an account that already has a profile:
  -- consent is the user's to change in settings, never something a later
  -- sign-in silently rewrites.
  on conflict (auth_user_id) do update
  set email = excluded.email;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
