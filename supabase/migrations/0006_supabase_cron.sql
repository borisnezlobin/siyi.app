create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.invoke_siyi_notification_evaluator()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  evaluator_url text;
  cron_secret text;
  request_id bigint;
begin
  select decrypted_secret
  into evaluator_url
  from vault.decrypted_secrets
  where name = 'siyi_notification_cron_url'
  limit 1;

  select decrypted_secret
  into cron_secret
  from vault.decrypted_secrets
  where name = 'siyi_notification_cron_secret'
  limit 1;

  if evaluator_url is null or cron_secret is null then
    raise warning 'Notification cron secrets are not configured in Vault.';
    return null;
  end if;

  select net.http_get(
    url := evaluator_url,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cron_secret,
      'Accept', 'application/json'
    ),
    timeout_milliseconds := 15000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function public.invoke_siyi_notification_evaluator() from public;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
  from cron.job
  where jobname = 'siyi-notifications-hourly'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'siyi-notifications-hourly',
  '3 * * * *',
  'select public.invoke_siyi_notification_evaluator()'
);
