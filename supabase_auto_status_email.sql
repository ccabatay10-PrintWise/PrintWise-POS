-- PrintWise automatic customer email updates
-- Sends an email whenever a received file job moves to REVIEWING, PROCESSING, READY, or COMPLETED.

create extension if not exists pg_net;

create or replace function public.notify_printwise_status_email()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
begin
  if new.status is distinct from old.status
     and new.status in ('REVIEWING', 'PROCESSING', 'READY', 'COMPLETED') then
    perform net.http_post(
      url := 'https://print-wise-pos.vercel.app/api/email/send',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'jobId', new.id,
        'status', new.status,
        'automatic', true
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists printwise_received_file_status_email on public.received_file_jobs;

create trigger printwise_received_file_status_email
after update of status on public.received_file_jobs
for each row
execute function public.notify_printwise_status_email();
