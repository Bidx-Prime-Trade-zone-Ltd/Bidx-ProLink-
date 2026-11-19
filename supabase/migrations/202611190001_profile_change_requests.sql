create table if not exists public.prolink_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_changes jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  review_reason text,
  approved_at timestamptz
);
create index if not exists prolink_profile_change_requests_user_status_idx
  on public.prolink_profile_change_requests(user_id,status,requested_at desc);
alter table public.prolink_profile_change_requests enable row level security;
revoke all on public.prolink_profile_change_requests from anon, authenticated;
grant all on public.prolink_profile_change_requests to service_role;
