-- PrintWise Received Files - Staff Edit / Finished File Workflow
-- Tracks staff-edited versions and allows authenticated staff to update file records.

alter table public.received_file_items
  add column if not exists edit_status text not null default 'NOT_REQUIRED',
  add column if not exists final_storage_path text,
  add column if not exists final_name text,
  add column if not exists final_mime_type text,
  add column if not exists final_size_bytes bigint,
  add column if not exists staff_processed_at timestamptz;

alter table public.received_file_items
  drop constraint if exists received_file_items_edit_status_check;

alter table public.received_file_items
  add constraint received_file_items_edit_status_check
  check (edit_status in ('NOT_REQUIRED','NEEDS_EDIT','EDITING','FINISHED'));

update public.received_file_items
set edit_status = 'NOT_REQUIRED'
where edit_status is null;

drop policy if exists "received_file_items_update_authenticated" on public.received_file_items;
create policy "received_file_items_update_authenticated"
on public.received_file_items
for update to authenticated
using (true)
with check (true);

create index if not exists received_file_items_edit_status_idx
on public.received_file_items(edit_status);
