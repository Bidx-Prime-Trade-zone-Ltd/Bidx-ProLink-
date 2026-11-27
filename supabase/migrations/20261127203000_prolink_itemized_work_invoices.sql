alter table public.prolink_work_request_invoices
  add column if not exists line_items jsonb not null default '[]'::jsonb,
  add column if not exists subtotal numeric(14,2) not null default 0,
  add column if not exists tax_percent numeric(7,3) not null default 0,
  add column if not exists tax_amount numeric(14,2) not null default 0,
  add column if not exists discount_amount numeric(14,2) not null default 0,
  add column if not exists notes text not null default '',
  add column if not exists from_name text not null default '',
  add column if not exists from_address text not null default '',
  add column if not exists from_contact text not null default '',
  add column if not exists bill_to_name text not null default '',
  add column if not exists bill_to_address text not null default '';
alter table public.prolink_work_request_invoices
  add constraint prolink_work_request_invoice_line_items_array
  check (jsonb_typeof(line_items) = 'array' and jsonb_array_length(line_items) <= 100);
comment on column public.prolink_work_request_invoices.line_items is
  'Itemised invoice rows validated and calculated by the authenticated Worker.';