create unique index if not exists product_versions_product_version_key
  on public.product_versions (product_id, version);

update public.products
set
  name = 'Prospection éthique avec l’IA',
  description = 'Pack multiplateforme de prospection éthique pour Claude et ChatGPT.',
  status = 'published',
  price = 39,
  version = '1.0.0',
  zip_path = 'prospection-ethique/prospection-ethique-v1.0.0.zip'
where slug = 'prospection-ethique';

insert into public.product_versions (
  product_id,
  version,
  release_notes,
  zip_path,
  status,
  published_at
)
select
  id,
  '1.0.0',
  'Pack multiplateforme avec skill Claude, instructions ChatGPT et guide d’installation.',
  'prospection-ethique/prospection-ethique-v1.0.0.zip',
  'published',
  now()
from public.products
where slug = 'prospection-ethique'
on conflict (product_id, version) do update
set
  release_notes = excluded.release_notes,
  zip_path = excluded.zip_path,
  status = excluded.status,
  published_at = excluded.published_at;

insert into storage.buckets (id, name, public, allowed_mime_types)
values ('product-packs', 'product-packs', false, array['application/zip'])
on conflict (id) do update
set public = false, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.complete_saspay_order(
  p_order_id uuid,
  p_provider_payment_id text,
  p_grant_admin boolean
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

  if p_grant_admin and v_order.coupon_code = 'ADMIN' and v_order.user_id is not null then
    update public.profiles
    set role = 'admin'
    where id = v_order.user_id;
  end if;
end;
$$;

revoke all on function public.complete_saspay_order(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.complete_saspay_order(uuid, text, boolean) to service_role;
