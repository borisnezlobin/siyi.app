-- Consent given on the signup form travels in the auth user's metadata, because
-- the profile row does not exist yet when the form is submitted and, with email
-- confirmations on, there is no session to write it with afterwards. The
-- bootstrap trigger is the one place that sees both.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  consented boolean;
begin
  consented := coalesce(
    (new.raw_user_meta_data ->> 'marketing_opt_in')::boolean,
    false
  );

  insert into public.user_profiles (
    auth_user_id,
    display_name,
    email,
    marketing_opt_in,
    marketing_opt_in_at
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
    case when consented then now() else null end
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
