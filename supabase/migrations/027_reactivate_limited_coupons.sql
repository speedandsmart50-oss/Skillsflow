-- SMART is limited to 20 free skill activations in total (one per account).
create or replace function public.redeem_smart_coupon(
  p_user_id uuid,
  p_product_id uuid,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_order_id uuid;
  v_now timestamptz := now();
begin
  if p_user_id is null or p_product_id is null or p_request_id is null then
    raise exception 'Invalid coupon redemption request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('coupon:SMART', 0));

  select id into v_order_id
  from public.orders
  where request_id = p_request_id;
  if found then
    if exists (
      select 1 from public.orders
      where request_id = p_request_id
        and user_id = p_user_id
        and product_id = p_product_id
        and coupon_code = 'SMART'
        and payment_status = 'paid'
    ) then
      return v_order_id;
    end if;
    raise exception 'This request ID has already been used';
  end if;

  if exists (select 1 from public.orders where user_id = p_user_id and coupon_code = 'SMART') then
    raise exception 'SMART coupon already redeemed';
  end if;

  if (select count(*) from public.orders where coupon_code = 'SMART' and payment_status = 'paid') >= 20 then
    raise exception 'SMART coupon exhausted';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for share;
  if not found
    or v_product.status <> 'published'
    or v_product.catalog_status <> 'disponible'
    or v_product.archived_at is not null then
    raise exception 'Skill is not available';
  end if;
  if v_product.price_eur is null or v_product.price_eur <= 0 or v_product.price_xof is null then
    raise exception 'Skill price is invalid';
  end if;

  if exists (
    select 1 from public.entitlements
    where user_id = p_user_id and product_id = p_product_id and status = 'active'
  ) then
    raise exception 'Skill is already available on this account';
  end if;

  v_order_id := gen_random_uuid();
  insert into public.orders (
    id, user_id, product_id, total, total_xof, subtotal_eur, discount_eur,
    coupon_code, currency, payment_status, order_reference, request_id,
    terms_accepted_at, paid_at, activation_source, activated_at
  ) values (
    v_order_id, p_user_id, p_product_id, 0, 0, v_product.price_eur,
    v_product.price_eur, 'SMART', 'XOF', 'paid',
    'SMART-' || v_order_id::text, p_request_id, v_now, v_now, 'coupon', v_now
  );

  insert into public.entitlements (user_id, product_id, order_id, source, status, granted_at)
  values (p_user_id, p_product_id, v_order_id, 'coupon', 'active', v_now);

  return v_order_id;
end;
$$;

revoke all on function public.redeem_smart_coupon(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.redeem_smart_coupon(uuid, uuid, uuid) to service_role;

-- Reserve each of the three GOPRO discounts atomically when checkout starts.
create table public.gopro_coupon_reservations (
  request_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.gopro_coupon_reservations enable row level security;
revoke all on public.gopro_coupon_reservations from anon, authenticated;
grant all on public.gopro_coupon_reservations to service_role;

create or replace function public.reserve_gopro_coupon(p_user_id uuid, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null or p_request_id is null then
    raise exception 'Invalid coupon reservation request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('coupon:GOPRO', 0));

  if exists (select 1 from public.gopro_coupon_reservations where request_id = p_request_id) then
    if exists (select 1 from public.gopro_coupon_reservations where request_id = p_request_id and user_id = p_user_id) then
      return;
    end if;
    raise exception 'This request ID has already been used';
  end if;

  if (select count(*) from public.gopro_coupon_reservations) >= 3 then
    raise exception 'GOPRO coupon exhausted';
  end if;

  insert into public.gopro_coupon_reservations (request_id, user_id)
  values (p_request_id, p_user_id);
end;
$$;

create or replace function public.release_gopro_coupon(p_user_id uuid, p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.gopro_coupon_reservations
  where request_id = p_request_id and user_id = p_user_id;
end;
$$;

revoke all on function public.reserve_gopro_coupon(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_gopro_coupon(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_gopro_coupon(uuid, uuid) to service_role;
grant execute on function public.release_gopro_coupon(uuid, uuid) to service_role;
