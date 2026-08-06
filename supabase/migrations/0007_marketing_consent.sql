alter table public.user_profiles
add column if not exists marketing_opt_in boolean not null default false;

alter table public.user_profiles
add column if not exists marketing_opt_in_at timestamptz;

create index if not exists user_profiles_marketing_opt_in_idx
on public.user_profiles(auth_user_id)
where marketing_opt_in;
