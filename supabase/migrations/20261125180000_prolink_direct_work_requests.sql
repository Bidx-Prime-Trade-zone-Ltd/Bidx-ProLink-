create table if not exists public.prolink_work_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete restrict,
  professional_user_id uuid not null references auth.users(id) on delete restrict,
  professional_name text not null,
  job_description text not null,
  preferred_date date,
  job_location text not null,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint prolink_work_requests_distinct_parties
    check (requester_user_id <> professional_user_id),
  constraint prolink_work_requests_description_length
    check (char_length(trim(job_description)) between 10 and 5000),
  constraint prolink_work_requests_location_length
    check (char_length(trim(job_location)) between 2 and 500)
);

create index if not exists prolink_work_requests_requester_created_idx
  on public.prolink_work_requests (requester_user_id, created_at desc);
create index if not exists prolink_work_requests_professional_created_idx
  on public.prolink_work_requests (professional_user_id, created_at desc);

alter table public.prolink_work_requests enable row level security;
revoke all on table public.prolink_work_requests from anon, authenticated;
grant all on table public.prolink_work_requests to service_role;

comment on table public.prolink_work_requests is
  'Private one-to-one customer-to-professional work requests. All access is mediated by the authenticated ProLink Worker; Admin retains a separate audit copy.';
