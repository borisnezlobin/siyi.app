create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_profiles (
    auth_user_id,
    display_name,
    email
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    ),
    coalesce(new.email, '')
  )
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

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

insert into public.user_profiles (
  auth_user_id,
  display_name,
  email
)
select
  users.id,
  coalesce(
    users.raw_user_meta_data ->> 'full_name',
    users.raw_user_meta_data ->> 'name',
    ''
  ),
  coalesce(users.email, '')
from auth.users
on conflict (auth_user_id) do nothing;

insert into public.user_settings (user_id)
select users.id
from auth.users
on conflict (user_id) do nothing;

insert into public.notification_preferences (user_id)
select users.id
from auth.users
on conflict (user_id) do nothing;
