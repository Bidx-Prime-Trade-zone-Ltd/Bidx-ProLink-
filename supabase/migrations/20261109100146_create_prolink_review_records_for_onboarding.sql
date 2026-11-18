-- Original onboarding review queue foundation (already applied to Bidx ProLink).
create table if not exists public.prolink_review_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null check (section in ('legal_identity','professional_profile','supporting_document')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','removed')),
  submitted_data jsonb not null default '{}'::jsonb,
  document_path text,
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  removed_at timestamptz
);
create index if not exists prolink_review_records_status_idx on public.prolink_review_records(status,submitted_at desc);
create index if not exists prolink_review_records_user_idx on public.prolink_review_records(user_id,submitted_at desc);
alter table public.prolink_review_records enable row level security;
create policy "users read own review records" on public.prolink_review_records
for select to authenticated using(user_id=auth.uid());
create policy "users submit own review records" on public.prolink_review_records
for insert to authenticated with check(user_id=auth.uid() and status='pending' and reviewed_by is null);
grant select,insert on public.prolink_review_records to authenticated;
revoke update,delete on public.prolink_review_records from authenticated;
