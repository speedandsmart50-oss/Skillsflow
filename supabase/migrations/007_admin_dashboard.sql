update storage.buckets
set allowed_mime_types = array[
  'application/zip',
  'text/markdown',
  'text/plain',
  'application/octet-stream'
]
where id = 'product-packs';

create or replace function public.admin_dashboard_metrics(p_since timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'sales',
    (
      select count(*)
      from public.orders
      where payment_status = 'paid'
        and paid_at >= p_since
    ),
    'revenue_eur',
    (
      select coalesce(sum(total), 0)
      from public.orders
      where payment_status = 'paid'
        and paid_at >= p_since
    ),
    'revenue_xof',
    (
      select coalesce(sum(total_xof), 0)
      from public.orders
      where payment_status = 'paid'
        and paid_at >= p_since
    ),
    'new_accounts',
    (
      select count(*)
      from public.profiles
      where role = 'client'
        and created_at >= p_since
    ),
    'waitlist_signups',
    (
      select count(*)
      from public.waitlist
      where created_at >= p_since
    )
  );
$$;

revoke all on function public.admin_dashboard_metrics(timestamptz) from public, anon, authenticated;
grant execute on function public.admin_dashboard_metrics(timestamptz) to service_role;
