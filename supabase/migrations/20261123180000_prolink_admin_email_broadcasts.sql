-- Admin-only, resumable email broadcast campaigns for ProLink.
create table if not exists public.prolink_admin_broadcasts (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (length(trim(subject)) between 1 and 180),
  body text not null check (length(trim(body)) between 1 and 10000),
  recipient_emails jsonb not null default '[]'::jsonb,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  next_index integer not null default 0 check (next_index >= 0),
  status text not null default 'queued' check (status in ('queued','sending','paused','sent')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text
);
create index if not exists prolink_admin_broadcasts_created_idx
  on public.prolink_admin_broadcasts(created_at desc);
alter table public.prolink_admin_broadcasts enable row level security;
revoke all on public.prolink_admin_broadcasts from anon, authenticated;
comment on table public.prolink_admin_broadcasts is
  'Private ProLink Admin email broadcast campaigns and resumable recipient progress. Access only through the authenticated Admin Worker API.';
