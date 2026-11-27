create table if not exists public.prolink_work_request_attachments (
  id uuid primary key default gen_random_uuid(),
  work_request_id uuid not null references public.prolink_work_requests(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  storage_key text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size between 1 and 10485760),
  kind text not null check (kind in ('image','file')),
  caption text not null default '' check (char_length(caption) <= 1000),
  created_at timestamptz not null default now(),
  recipient_read_at timestamptz
);
create index if not exists prolink_work_request_attachments_thread_idx
  on public.prolink_work_request_attachments(work_request_id, created_at asc);
alter table public.prolink_work_request_attachments enable row level security;
revoke all on public.prolink_work_request_attachments from anon, authenticated;
grant all on public.prolink_work_request_attachments to service_role;
comment on table public.prolink_work_request_attachments is
  'Private customer-professional conversation files. All reads and writes are mediated by the authenticated ProLink Worker and participant checks.';
