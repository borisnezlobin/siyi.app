-- One row per campaign per person, written before the send is attempted. The
-- unique constraint is what stops a retried cron run, or two runs overlapping,
-- from mailing the same nudge twice.

create table if not exists public.lifecycle_email_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  campaign text not null,
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  failure_reason text,
  unique (user_id, campaign)
);

create index if not exists lifecycle_email_sends_user_idx
on public.lifecycle_email_sends(user_id);

alter table public.lifecycle_email_sends enable row level security;

-- No policies: this is operational data about sending, not something a user
-- reads. The service role bypasses row level security, and nothing else should
-- reach it at all.
