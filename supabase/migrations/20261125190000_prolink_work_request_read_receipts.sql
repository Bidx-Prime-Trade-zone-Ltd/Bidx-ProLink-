alter table public.prolink_work_requests add column if not exists professional_read_at timestamptz;
create index if not exists prolink_work_requests_professional_unread_idx on public.prolink_work_requests (professional_user_id, created_at desc) where professional_read_at is null;
