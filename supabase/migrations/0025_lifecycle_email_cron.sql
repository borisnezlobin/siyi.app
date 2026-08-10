-- Same shape as the notification job in 0006: the URL and the shared secret
-- live in Vault, never in the schedule itself. Add them there as
-- `siyi_lifecycle_email_cron_url` and reuse `siyi_notification_cron_secret`.
--
-- Once a day rather than hourly: these are nudges, and the campaign predicates
-- are written in days, so an hourly tick would only find the same nobody 23
-- more times.

create or replace function public.invoke_siyi_lifecycle_email()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender_url text;
  cron_secret text;
  request_id bigint;
begin
  select decrypted_secret
  into sender_url
  from vault.decrypted_secrets
  where name = 'siyi_lifecycle_email_cron_url'
  limit 1;

  select decrypted_secret
  into cron_secret
  from vault.decrypted_secrets
  where name = 'siyi_notification_cron_secret'
  limit 1;

  if sender_url is null or cron_secret is null then
    raise warning 'Lifecycle email cron secrets are not configured in Vault.';
    return null;
  end if;

  select net.http_get(
    url := sender_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cron_secret,
      'Accept', 'application/json'
    ),
    timeout_milliseconds := 60000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_siyi_lifecycle_email() from public;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'siyi-lifecycle-email-daily'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

-- 17:20 UTC is mid-morning in California, which is where most of these
-- accounts are.
select cron.schedule(
  'siyi-lifecycle-email-daily',
  '20 17 * * *',
  'select public.invoke_siyi_lifecycle_email()'
);
