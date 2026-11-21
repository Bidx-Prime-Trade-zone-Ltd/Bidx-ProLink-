-- Separate delivery and read receipts for messages sent by a human ProLink Admin.
-- Keep read_at unchanged: it records when Admin reads an incoming user message.
alter table public.prolink_support_messages
  add column if not exists delivered_at timestamptz,
  add column if not exists user_read_at timestamptz;

create index if not exists prolink_support_messages_admin_delivery_idx
  on public.prolink_support_messages(conversation_id, created_at asc)
  where sender_role='admin' and delivered_at is null;

comment on column public.prolink_support_messages.delivered_at is
  'Timestamp when the ProLink user support chat fetched this human Admin message.';
comment on column public.prolink_support_messages.user_read_at is
  'Timestamp when the human Admin message was displayed in the open ProLink user support chat.';
