create table if not exists public.prolink_subscription_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tx_ref text not null unique,
  flutterwave_transaction_id text,
  amount numeric(10,2) not null check (amount = 5.00),
  currency text not null default 'USD' check (currency = 'USD'),
  status text not null default 'pending' check (status in ('pending','successful','failed')),
  checkout_url text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists prolink_subscription_payments_user_idx on public.prolink_subscription_payments(user_id,created_at desc);
alter table public.prolink_subscription_payments enable row level security;
revoke all on public.prolink_subscription_payments from anon,authenticated;

create table if not exists public.prolink_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.prolink_memberships enable row level security;
revoke all on public.prolink_memberships from anon,authenticated;
grant select on public.prolink_memberships to authenticated;
create policy "professionals read own membership" on public.prolink_memberships for select to authenticated using(user_id=(select auth.uid()));

create or replace function public.prolink_activate_membership(p_tx_ref text,p_transaction_id text)
returns timestamptz language plpgsql security definer set search_path=''
as $$
declare payment public.prolink_subscription_payments; current_expiry timestamptz; new_expiry timestamptz;
begin
  select * into payment from public.prolink_subscription_payments where tx_ref=p_tx_ref for update;
  if not found then raise exception 'Payment reference not found'; end if;
  if payment.status='successful' then
    if payment.flutterwave_transaction_id<>p_transaction_id then raise exception 'Payment reference already used'; end if;
    select expires_at into new_expiry from public.prolink_memberships where user_id=payment.user_id;
    return new_expiry;
  end if;
  if payment.status<>'pending' then raise exception 'Payment is not pending'; end if;
  select expires_at into current_expiry from public.prolink_memberships where user_id=payment.user_id for update;
  new_expiry:=greatest(coalesce(current_expiry,now()),now())+interval '12 months';
  insert into public.prolink_memberships(user_id,starts_at,expires_at,updated_at)
  values(payment.user_id,coalesce(current_expiry,now()),new_expiry,now())
  on conflict(user_id) do update set expires_at=excluded.expires_at,updated_at=now();
  update public.prolink_subscription_payments set status='successful',flutterwave_transaction_id=p_transaction_id,paid_at=now() where id=payment.id;
  return new_expiry;
end;
$$;
revoke all on function public.prolink_activate_membership(text,text) from public,anon,authenticated;
grant execute on function public.prolink_activate_membership(text,text) to service_role;
