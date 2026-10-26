create or replace function public.release_failed_gopro_coupon_reservation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.payment_status in ('failed', 'expired') and old.payment_status is distinct from new.payment_status then
    delete from public.gopro_coupon_reservations
    where request_id = new.request_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;

revoke all on function public.release_failed_gopro_coupon_reservation() from public, anon, authenticated;

drop trigger if exists orders_release_failed_gopro_coupon on public.orders;
create trigger orders_release_failed_gopro_coupon
after update of payment_status on public.orders
for each row execute function public.release_failed_gopro_coupon_reservation();
