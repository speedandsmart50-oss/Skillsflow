with ranked_active_keys as (
  select
    id,
    row_number() over (
      partition by user_id
      order by created_at desc, id desc
    ) as position
  from public.mcp_keys
  where status = 'active'
)
update public.mcp_keys
set status = 'revoked', revoked_at = now()
where id in (
  select id
  from ranked_active_keys
  where position > 1
);

create unique index if not exists mcp_keys_one_active_per_user_idx
  on public.mcp_keys (user_id)
  where status = 'active';

create or replace function public.rotate_mcp_key(
  p_user_id uuid,
  p_key_hash text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key_id uuid;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid MCP key hash';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'User profile not found';
  end if;

  update public.mcp_keys
  set status = 'revoked', revoked_at = now()
  where user_id = p_user_id
    and status = 'active';

  insert into public.mcp_keys (user_id, key_hash)
  values (p_user_id, p_key_hash)
  returning id into v_key_id;

  return v_key_id;
end;
$$;

revoke all on function public.rotate_mcp_key(uuid, text) from public, anon, authenticated;
grant execute on function public.rotate_mcp_key(uuid, text) to service_role;

create or replace function public.remove_waitlist_data_for_deleted_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.waitlist
  where lower(email) = lower(old.email);
  return old;
end;
$$;

revoke all on function public.remove_waitlist_data_for_deleted_user() from public, anon, authenticated;

create trigger remove_waitlist_data_after_auth_user_delete
after delete on auth.users
for each row execute function public.remove_waitlist_data_for_deleted_user();
