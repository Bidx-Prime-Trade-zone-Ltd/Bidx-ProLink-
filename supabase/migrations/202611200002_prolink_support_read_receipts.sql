-- Read receipts for the dedicated ProLink support conversation.
-- A message is marked read only when a human Admin opens that conversation.
alter table public.prolink_support_messages
  add column if not exists read_at timestamptz;

create index if not exists prolink_support_messages_unread_user_idx
  on public.prolink_support_messages(conversation_id,created_at asc)
  where sender_role='user' and read_at is null;

comment on column public.prolink_support_messages.read_at is
  'Timestamp when a human ProLink Admin opened/read this message. Null means not yet read.';
