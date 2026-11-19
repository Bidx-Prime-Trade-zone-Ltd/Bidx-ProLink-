-- Dedicated ProLink AI + human Admin support conversation.
-- This is intentionally separate from customer-to-professional service messages.
create table if not exists public.prolink_support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'ai_active'
    check (status in ('ai_active','admin_requested','admin_attending','resolved')),
  admin_requested_at timestamptz,
  admin_attended_at timestamptz,
  resolved_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists prolink_support_conversations_queue_idx
  on public.prolink_support_conversations(status,last_message_at desc);

create table if not exists public.prolink_support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.prolink_support_conversations(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_role text not null check (sender_role in ('user','ai','admin','system')),
  content text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  pinned_for_admin boolean not null default false,
  created_at timestamptz not null default now(),
  constraint prolink_support_message_has_content check (
    length(trim(content)) > 0 or jsonb_array_length(attachments) > 0
  )
);
create index if not exists prolink_support_messages_conversation_idx
  on public.prolink_support_messages(conversation_id,created_at asc);
create index if not exists prolink_support_messages_pinned_idx
  on public.prolink_support_messages(pinned_for_admin,created_at desc)
  where pinned_for_admin=true;

alter table public.prolink_support_conversations enable row level security;
alter table public.prolink_support_messages enable row level security;
revoke all on public.prolink_support_conversations from anon,authenticated;
revoke all on public.prolink_support_messages from anon,authenticated;
grant select,insert on public.prolink_support_conversations to authenticated;
grant select,insert on public.prolink_support_messages to authenticated;

drop policy if exists "Users read their own ProLink support conversation" on public.prolink_support_conversations;
create policy "Users read their own ProLink support conversation"
  on public.prolink_support_conversations for select to authenticated
  using(user_id=(select auth.uid()));
drop policy if exists "Users create their own ProLink support conversation" on public.prolink_support_conversations;
create policy "Users create their own ProLink support conversation"
  on public.prolink_support_conversations for insert to authenticated
  with check(user_id=(select auth.uid()) and status='ai_active');

drop policy if exists "Users read their own ProLink support messages" on public.prolink_support_messages;
create policy "Users read their own ProLink support messages"
  on public.prolink_support_messages for select to authenticated
  using(exists(
    select 1 from public.prolink_support_conversations c
    where c.id=conversation_id and c.user_id=(select auth.uid())
  ));
drop policy if exists "Users send only their own ProLink support messages" on public.prolink_support_messages;
create policy "Users send only their own ProLink support messages"
  on public.prolink_support_messages for insert to authenticated
  with check(
    sender_role='user'
    and sender_user_id=(select auth.uid())
    and exists(
      select 1 from public.prolink_support_conversations c
      where c.id=conversation_id and c.user_id=(select auth.uid())
    )
  );

comment on table public.prolink_support_conversations is
  'Private one-to-one AI and human Admin support conversations. Not customer-to-professional messaging.';
comment on table public.prolink_support_messages is
  'Chronological AI/user/Admin support messages and R2 attachment metadata. Admin access is server-mediated.';
