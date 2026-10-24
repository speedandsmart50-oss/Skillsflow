alter table public.profiles
  drop constraint if exists profiles_role_check;

update public.profiles
set role = 'client'
where role = 'customer';

alter table public.profiles
  alter column role set default 'client';

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('client', 'admin'));

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(id),
  action text not null,
  target_type text not null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx
  on public.audit_log (created_at desc);
create index if not exists audit_log_actor_user_id_idx
  on public.audit_log (actor_user_id, created_at desc);

alter table public.audit_log enable row level security;

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
grant select, insert on public.audit_log to service_role;

create policy "Admins can read audit log" on public.audit_log for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop function if exists public.complete_saspay_order(uuid, text, boolean);

create or replace function public.complete_saspay_order(
  p_order_id uuid,
  p_provider_payment_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.payment_status = 'paid' then
    if v_order.provider_payment_id = p_provider_payment_id then
      return;
    end if;
    raise exception 'Order is already associated with another payment';
  end if;

  if v_order.payment_status <> 'pending' then
    raise exception 'Order is not pending';
  end if;

  update public.orders
  set
    payment_status = 'paid',
    provider_payment_id = p_provider_payment_id,
    paid_at = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.complete_saspay_order(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_saspay_order(uuid, text) to service_role;
