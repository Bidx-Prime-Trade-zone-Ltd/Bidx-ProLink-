-- Index unread incoming support replies for fast per-user notification counts.
create index if not exists prolink_support_messages_user_unread_inbox_idx
  on public.prolink_support_messages(conversation_id)
  where sender_role='user' and read_at is null;

create index if not exists prolink_support_messages_recipient_unread_idx
  on public.prolink_support_messages(conversation_id, created_at asc)
  where sender_role in ('ai','admin') and user_read_at is null;
