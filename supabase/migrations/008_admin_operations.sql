create or replace function public.admin_set_profile_role(
  p_admin_user_id uuid,
  p_target_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_previous_role text;
  v_admin_count bigint;
begin
  perform pg_advisory_xact_lock(582091, 2);

  if p_role not in ('client', 'admin') then
    raise exception 'Invalid profile role';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_admin_user_id and role = 'admin'
  ) then
    raise exception 'Administrator access required';
  end if;

  select role into v_previous_role
  from public.profiles
  where id = p_target_user_id
  for update;

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_previous_role = 'admin' and p_role = 'client' then
    select count(*) into v_admin_count
    from public.profiles
    where role = 'admin';

    if v_admin_count <= 1 then
      raise exception 'Cannot remove the last administrator';
    end if;
  end if;

  update public.profiles
  set role = p_role
  where id = p_target_user_id;
end;
$$;

revoke all on function public.admin_set_profile_role(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_set_profile_role(uuid, uuid, text) to service_role;
