alter table public.products
  add column if not exists product_type text not null default 'skill',
  add column if not exists subscription_days integer;

alter table public.products
  drop constraint if exists products_product_type_check;
alter table public.products
  add constraint products_product_type_check
  check (product_type in ('skill', 'subscription'));
alter table public.products
  drop constraint if exists products_subscription_days_check;
alter table public.products
  add constraint products_subscription_days_check
  check ((product_type = 'skill' and subscription_days is null) or (product_type = 'subscription' and subscription_days between 1 and 366));

insert into public.products (
  slug, name, description, status, price, version, zip_path,
  domain, catalog_status, price_eur, price_xof, product_type, subscription_days
)
values
  ('skillflow-plus', 'SkillFlow Plus', 'Accès aux skills standards, aux ressources mensuelles et à la communauté complète.', 'published', 14.90, '1.0.0', null, 'Abonnement SkillFlow', 'disponible', 14.90, 9784, 'subscription', 30),
  ('skillflow-pro', 'SkillFlow Pro', 'Accès avancé aux skills, à MCP, au support prioritaire et aux configurations personnalisées.', 'published', 29.90, '1.0.0', null, 'Abonnement SkillFlow', 'disponible', 29.90, 19607, 'subscription', 30)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  status = excluded.status,
  price = excluded.price,
  domain = excluded.domain,
  catalog_status = excluded.catalog_status,
  price_eur = excluded.price_eur,
  price_xof = excluded.price_xof,
  product_type = excluded.product_type,
  subscription_days = excluded.subscription_days,
  archived_at = null,
  updated_at = now();

create table if not exists public.member_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete cascade,
  plan_slug text not null,
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (order_id)
);

create index if not exists member_subscriptions_user_status_idx
  on public.member_subscriptions (user_id, status, ends_at desc);

alter table public.member_subscriptions enable row level security;
drop policy if exists "Members can read own subscriptions" on public.member_subscriptions;
create policy "Members can read own subscriptions" on public.member_subscriptions
  for select using (auth.uid() = user_id);
drop policy if exists "Admins can read subscriptions" on public.member_subscriptions;
create policy "Admins can read subscriptions" on public.member_subscriptions
  for select using (public.is_current_user_admin());
revoke all on public.member_subscriptions from anon, authenticated;
grant select on public.member_subscriptions to authenticated;
grant all on public.member_subscriptions to service_role;

update public.skills
set is_included_in_membership = true, updated_at = now()
where is_active = true;

create or replace function public.grant_paid_order_entitlements(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_product_type text;
  v_subscription_days integer;
  v_plan_slug text;
  v_start timestamptz;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.user_id is null or v_order.product_id is null then
    raise exception 'Paid order has no valid customer or product';
  end if;
  if v_order.payment_status <> 'paid' then
    raise exception 'Order must be paid before granting access';
  end if;

  select product_type, subscription_days, slug
  into v_product_type, v_subscription_days, v_plan_slug
  from public.products
  where id = v_order.product_id;

  if v_product_type = 'subscription' then
    if exists (select 1 from public.member_subscriptions where order_id = p_order_id) then
      return;
    end if;
    select greatest(now(), coalesce(max(ends_at), now()))
    into v_start
    from public.member_subscriptions
    where user_id = v_order.user_id
      and status = 'active'
      and ends_at > now();
    insert into public.member_subscriptions (user_id, product_id, order_id, plan_slug, status, starts_at, ends_at)
    values (v_order.user_id, v_order.product_id, p_order_id, v_plan_slug, 'active', v_start, v_start + make_interval(days => v_subscription_days));
    return;
  end if;

  if exists (select 1 from public.product_bundle_items where bundle_product_id = v_order.product_id) then
    insert into public.entitlements (user_id, product_id, order_id, source, status, granted_at, revoked_at, revoke_reason)
    select v_order.user_id, item.item_product_id, v_order.id, 'payment', 'active', now(), null, null
    from public.product_bundle_items item
    where item.bundle_product_id = v_order.product_id
      and not exists (
        select 1 from public.entitlements existing
        where existing.user_id = v_order.user_id
          and existing.product_id = item.item_product_id
          and existing.status = 'active'
          and existing.order_id is distinct from v_order.id
      )
    on conflict (order_id, product_id) where order_id is not null
    do update set status = 'active', granted_at = now(), revoked_at = null, revoke_reason = null;
  else
    insert into public.entitlements (user_id, product_id, order_id, source, status, granted_at, revoked_at, revoke_reason)
    values (v_order.user_id, v_order.product_id, v_order.id, 'payment', 'active', now(), null, null)
    on conflict (order_id, product_id) where order_id is not null
    do update set status = 'active', granted_at = now(), revoked_at = null, revoke_reason = null;
  end if;
end;
$$;

create or replace function public.can_access_skill(p_user_id uuid, p_skill_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select (auth.uid()=p_user_id or auth.role()='service_role') and exists(
    select 1 from public.skills s where s.id=p_skill_id and s.is_active and (
      (s.is_included_in_membership and exists(select 1 from public.member_subscriptions ms where ms.user_id=p_user_id and ms.status='active' and ms.ends_at>now()))
      or (s.is_included_in_membership and exists(select 1 from public.member_skills ms where ms.user_id=p_user_id and ms.skill_id=s.id and ms.source='subscription' and ms.status='active' and (ms.expires_at is null or ms.expires_at>now())))
      or exists(select 1 from public.member_skills ms where ms.user_id=p_user_id and ms.skill_id=s.id and ms.status='active' and (ms.expires_at is null or ms.expires_at>now()))
      or exists(select 1 from public.entitlements e where e.user_id=p_user_id and e.product_id=s.product_id and e.status='active')
    )
  );
$$;
