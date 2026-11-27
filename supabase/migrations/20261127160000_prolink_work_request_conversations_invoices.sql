create table if not exists public.prolink_work_request_messages (
  id uuid primary key default gen_random_uuid(),
  work_request_id uuid not null references public.prolink_work_requests(id) on delete cascade,
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  recipient_read_at timestamptz
);
create index if not exists prolink_work_request_messages_thread_idx
  on public.prolink_work_request_messages(work_request_id, created_at asc);
alter table public.prolink_work_request_messages enable row level security;
revoke all on public.prolink_work_request_messages from anon, authenticated;
grant all on public.prolink_work_request_messages to service_role;

create table if not exists public.prolink_work_request_invoices (
  id uuid primary key default gen_random_uuid(),
  work_request_id uuid not null references public.prolink_work_requests(id) on delete cascade,
  invoice_number text not null unique default ('PL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  sender_user_id uuid not null references auth.users(id) on delete restrict,
  invoice_date date not null default current_date,
  due_date date,
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3,8}$'),
  amount numeric(14,2) not null check (amount > 0),
  quotation text not null check (char_length(trim(quotation)) between 5 and 5000),
  status text not null default 'sent' check (status in ('sent','accepted','declined','paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  recipient_read_at timestamptz
);
create index if not exists prolink_work_request_invoices_thread_idx
  on public.prolink_work_request_invoices(work_request_id, created_at desc);
alter table public.prolink_work_request_invoices enable row level security;
revoke all on public.prolink_work_request_invoices from anon, authenticated;
grant all on public.prolink_work_request_invoices to service_role;

comment on table public.prolink_work_request_messages is
  'Private customer-professional conversation attached to a single ProLink work request; access is mediated by the authenticated Worker.';
comment on table public.prolink_work_request_invoices is
  'Quotations and invoices sent by professionals to the customer within a ProLink work-request conversation; access is mediated by the authenticated Worker.';
