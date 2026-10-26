create table public.product_bundle_items (
  bundle_product_id uuid not null references public.products(id) on delete cascade,
  item_product_id uuid not null references public.products(id) on delete restrict,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (bundle_product_id, item_product_id),
  check (bundle_product_id <> item_product_id)
);

create index product_bundle_items_item_product_id_idx
  on public.product_bundle_items (item_product_id);

alter table public.product_bundle_items enable row level security;
create policy "Public can read published bundle contents" on public.product_bundle_items
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products bundle
      where bundle.id = bundle_product_id
        and bundle.status = 'published'
        and bundle.catalog_status = 'disponible'
        and bundle.archived_at is null
    )
  );
create policy "Admins manage product bundle contents" on public.product_bundle_items
  for all to authenticated
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
revoke all on public.product_bundle_items from anon, authenticated;
grant select on public.product_bundle_items to anon;
grant select, insert, update, delete on public.product_bundle_items to authenticated;
grant all on public.product_bundle_items to service_role;

-- One payment order can grant access to several skills in the same pack.
drop index if exists public.entitlements_order_id_key;
create unique index entitlements_order_product_id_key
  on public.entitlements (order_id, product_id)
  where order_id is not null;

create or replace function public.grant_paid_order_entitlements(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found or v_order.user_id is null or v_order.product_id is null then
    raise exception 'Paid order has no valid customer or product';
  end if;
  if v_order.payment_status <> 'paid' then
    raise exception 'Order must be paid before granting access';
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

revoke all on function public.grant_paid_order_entitlements(uuid) from public, anon, authenticated, service_role;

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

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.user_id is null or v_order.product_id is null or v_order.total_xof is null then
    raise exception 'Order has no valid customer, product, or amount';
  end if;
  if v_order.payment_status = 'paid' then
    if v_order.provider_payment_id = p_provider_payment_id then
      perform public.grant_paid_order_entitlements(v_order.id);
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

  perform public.grant_paid_order_entitlements(p_order_id);
end;
$$;

revoke all on function public.activate_saspay_order(uuid, text, text) from public, anon, authenticated;
grant execute on function public.activate_saspay_order(uuid, text, text) to service_role;

-- The bundle is priced at the sum of its four current individual skills (EUR 96).
insert into public.products (
  slug, name, description, status, price, version, zip_path,
  domain, catalog_status, price_eur, price_xof
)
values (
  'pack-marketing-reseau',
  'Pack Marketing de réseau',
  'Quatre skills réunis pour accompagner les activités de marketing de réseau : prospection, qualification, coaching d’équipe et duplication.',
  'published', 96.00, '1.0.0', null,
  'Marketing de réseau', 'disponible', 96.00, 62972
)
on conflict (slug) do nothing;

insert into public.product_bundle_items (bundle_product_id, item_product_id, position)
select bundle.id, item.id, included.position
from public.products bundle
cross join (values
  ('go-pro-mlm', 1),
  ('qualification-prospects-mlm', 2),
  ('coach-equipe-mlm', 3),
  ('duplication-mlm', 4)
) as included(slug, position)
join public.products item on item.slug = included.slug
where bundle.slug = 'pack-marketing-reseau'
on conflict (bundle_product_id, item_product_id) do update set position = excluded.position;
