create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function public.handle_new_user();

alter table public.orders
  add column if not exists order_reference text,
  add column if not exists request_id uuid,
  add column if not exists provider_checkout_id text,
  add column if not exists provider_payment_id text,
  add column if not exists checkout_url text,
  add column if not exists currency text not null default 'XOF',
  add column if not exists subtotal_eur numeric(10, 2) not null default 0,
  add column if not exists discount_eur numeric(10, 2) not null default 0,
  add column if not exists coupon_code text,
  add column if not exists total_xof bigint,
  add column if not exists paid_at timestamptz;

update public.orders
set order_reference = 'legacy-' || id::text
where order_reference is null;

alter table public.orders
  alter column order_reference set not null;

create unique index if not exists orders_order_reference_key
  on public.orders (order_reference);
create unique index if not exists orders_request_id_key
  on public.orders (request_id)
  where request_id is not null;
create unique index if not exists orders_provider_checkout_id_key
  on public.orders (provider_checkout_id)
  where provider_checkout_id is not null;
create unique index if not exists orders_provider_payment_id_key
  on public.orders (provider_payment_id)
  where provider_payment_id is not null;

insert into public.products (
  id,
  slug,
  name,
  description,
  status,
  price,
  version
)
values (
  '00000000-0000-4000-8000-000000000039',
  'prospection-ethique',
  'Prospection éthique avec l’IA',
  'SkillFlow sandbox checkout product. This draft is not available for live sales.',
  'draft',
  39,
  '0.1.0'
)
on conflict (slug) do nothing;
