-- Durable payment audit + shared idempotent activation metadata.
alter table public.orders
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists activation_source text,
  add column if not exists activated_at timestamptz,
  add column if not exists last_reconciled_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('pending', 'paid', 'failed', 'expired'));

alter table public.orders drop constraint if exists orders_activation_source_check;
alter table public.orders
  add constraint orders_activation_source_check
  check (activation_source is null or activation_source in ('webhook', 'return', 'cron', 'manual'));

create index if not exists orders_pending_reconciliation_idx
  on public.orders (last_reconciled_at, created_at)
  where payment_status in ('pending', 'failed', 'expired');

create or replace function public.set_order_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_order_updated_at();
revoke all on function public.set_order_updated_at() from public, anon, authenticated;

create table if not exists public.saspay_webhook_logs (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  headers jsonb not null default '{}'::jsonb,
  raw_body text not null,
  signature_valid boolean,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'rejected', 'error')),
  response_status integer,
  order_reference text,
  provider_payment_id text,
  error_message text,
  processed_at timestamptz
);
create index if not exists saspay_webhook_logs_received_at_idx
  on public.saspay_webhook_logs (received_at desc);
create index if not exists saspay_webhook_logs_reference_idx
  on public.saspay_webhook_logs (order_reference)
  where order_reference is not null;
alter table public.saspay_webhook_logs enable row level security;
revoke all on public.saspay_webhook_logs from public, anon, authenticated;
grant all on public.saspay_webhook_logs to service_role;

create table if not exists public.payment_reconciliation_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete set null,
  order_reference text,
  source text not null check (source in ('cron', 'manual', 'return')),
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists payment_reconciliation_logs_created_at_idx
  on public.payment_reconciliation_logs (created_at desc);
alter table public.payment_reconciliation_logs enable row level security;
revoke all on public.payment_reconciliation_logs from public, anon, authenticated;
grant all on public.payment_reconciliation_logs to service_role;

create or replace function public.activate_saspay_order(
  p_order_id uuid,
  p_provider_payment_id text,
  p_activation_source text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_activation_source not in ('webhook', 'return', 'cron', 'manual') then
    raise exception 'Invalid activation source';
  end if;
  if p_provider_payment_id is null or length(p_provider_payment_id) = 0 then
    raise exception 'Provider payment id is required';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.user_id is null or v_order.product_id is null or v_order.total_xof is null then
    raise exception 'Order has no valid customer, product, or amount';
  end if;
  if v_order.payment_status = 'paid' then
    if v_order.provider_payment_id = p_provider_payment_id then
      insert into public.entitlements (user_id, product_id, order_id, source, status, granted_at, revoked_at, revoke_reason)
      values (v_order.user_id, v_order.product_id, v_order.id, 'payment', 'active', now(), null, null)
      on conflict (order_id) where order_id is not null
      do update set status = 'active', granted_at = now(), revoked_at = null, revoke_reason = null;
      return;
    end if;
    raise exception 'Order is already associated with another payment';
  end if;
  if v_order.payment_status not in ('pending', 'failed', 'expired') then
    raise exception 'Order is not pending';
  end if;
  if v_order.provider_payment_id is not null and v_order.provider_payment_id <> p_provider_payment_id then
    raise exception 'Order is already associated with another payment';
  end if;

  update public.orders
  set payment_status = 'paid',
      provider_payment_id = p_provider_payment_id,
      activation_source = p_activation_source,
      paid_at = now(),
      activated_at = now()
  where id = p_order_id;

  insert into public.entitlements (user_id, product_id, order_id, source, status, granted_at, revoked_at, revoke_reason)
  values (v_order.user_id, v_order.product_id, v_order.id, 'payment', 'active', now(), null, null)
  on conflict (order_id) where order_id is not null
  do update set status = 'active', granted_at = now(), revoked_at = null, revoke_reason = null;
end;
$$;

revoke all on function public.activate_saspay_order(uuid, text, text) from public, anon, authenticated;
grant execute on function public.activate_saspay_order(uuid, text, text) to service_role;

-- Retire the former direct-completion RPC so application code has one audited
-- activation entry point with an explicit source.
revoke all on function public.complete_saspay_order(uuid, text) from public, anon, authenticated, service_role;
