-- Referrals: a code each person can share, and a record of who brought whom.
--
-- The code is not a secret — it is meant to be read off a screen, texted, or
-- said out loud — so it is short and drawn from an alphabet with no characters
-- that get confused for each other (no I, L, O, 0 or 1). It is generated the
-- first time someone asks for it rather than at signup, so an account that
-- never shares never gets a code.
--
-- `referred_by` is written once, at signup, and never again. There is no
-- "change who referred me": the whole value of the number is that it cannot be
-- edited after the fact by the person it credits.
--
-- Safe to run twice.

alter table public.user_profiles
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references auth.users(id) on delete set null,
  add column if not exists referred_at timestamptz;

alter table public.user_profiles
  drop constraint if exists user_profiles_referral_code_check;

alter table public.user_profiles
  add constraint user_profiles_referral_code_check
  check (referral_code is null or referral_code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{7}$');

-- Self-referral is not a race to lose; it is simply not a thing that exists.
alter table public.user_profiles
  drop constraint if exists user_profiles_referred_by_not_self;

alter table public.user_profiles
  add constraint user_profiles_referred_by_not_self
  check (referred_by is null or referred_by <> auth_user_id);

create unique index if not exists user_profiles_referral_code_key
  on public.user_profiles (referral_code)
  where referral_code is not null;

create index if not exists user_profiles_referred_by_idx
  on public.user_profiles (referred_by)
  where referred_by is not null;

/**
 * Claiming a referral.
 *
 * Security definer because the joiner must be able to look up a code belonging
 * to a stranger's profile, which RLS rightly forbids them from reading. The
 * function returns nothing about that stranger — only whether the claim landed
 * — so it cannot be used to enumerate accounts beyond confirming a code exists,
 * which is what a referral code is for.
 *
 * Every guard that matters is in here rather than in the caller: the claim is
 * one-way, cannot name yourself, and cannot overwrite an existing credit.
 */
create or replace function public.claim_referral(code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  referrer uuid;
  updated integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  select auth_user_id into referrer
  from public.user_profiles
  where referral_code = upper(trim(code));

  if referrer is null or referrer = auth.uid() then
    return false;
  end if;

  -- The `referred_by is null` predicate is what makes this one-way: a second
  -- call finds no row to update and reports that nothing happened.
  update public.user_profiles
  set referred_by = referrer,
      referred_at = now()
  where auth_user_id = auth.uid()
    and referred_by is null;

  get diagnostics updated = row_count;
  return updated > 0;
end;
$$;

revoke all on function public.claim_referral(text) from public;
grant execute on function public.claim_referral(text) to authenticated;

/**
 * How many accounts the caller has brought in.
 *
 * RLS restricts a profile read to your own row, which is right and which also
 * means you cannot count rows pointing at you. This returns that one number and
 * nothing else — no ids, no names, no timestamps — so the count can be shown
 * without exposing who is behind it.
 */
create or replace function public.referral_count()
returns integer
language sql
security definer
set search_path = ''
stable
as $$
  select count(*)::integer
  from public.user_profiles
  where referred_by = auth.uid();
$$;

revoke all on function public.referral_count() from public;
grant execute on function public.referral_count() to authenticated;
