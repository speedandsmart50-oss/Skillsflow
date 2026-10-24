-- Public social proof exposes only product and paid time, never buyer identity or order details.
create or replace function public.get_recent_paid_sales()
returns table(product_name text, product_slug text, paid_at timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select products.name, products.slug, orders.paid_at
  from public.orders
  join public.products on products.id = orders.product_id
  where orders.payment_status = 'paid'
    and orders.paid_at >= now() - interval '24 hours'
    and products.status = 'published'
    and products.archived_at is null
  order by orders.paid_at desc
  limit 8;
$$;

revoke all on function public.get_recent_paid_sales() from public;
grant execute on function public.get_recent_paid_sales() to anon, authenticated;
