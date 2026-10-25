-- Keep server-side quotas out of member-editable usage history.
alter table public.mcp_tool_usage enable row level security;
drop policy if exists member_owns_rows on public.mcp_tool_usage;
drop policy if exists members_read_own_mcp_usage on public.mcp_tool_usage;
create policy members_read_own_mcp_usage
  on public.mcp_tool_usage for select to authenticated
  using (auth.uid() = user_id);
revoke all on public.mcp_tool_usage from anon, authenticated;
grant select on public.mcp_tool_usage to authenticated;
grant all on public.mcp_tool_usage to service_role;

create table if not exists public.api_rate_limit_buckets (
  scope text not null check (scope in ('mcp_user', 'mcp_ip', 'checkout_user', 'conversation_user')),
  subject_key text not null check (char_length(subject_key) between 16 and 128),
  tokens numeric not null check (tokens >= 0),
  updated_at timestamptz not null,
  primary key (scope, subject_key)
);
create index if not exists api_rate_limit_buckets_updated_at_idx
  on public.api_rate_limit_buckets(updated_at);
alter table public.api_rate_limit_buckets enable row level security;
revoke all on public.api_rate_limit_buckets from public, anon, authenticated;
grant all on public.api_rate_limit_buckets to service_role;

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_subject_key text
)
returns table (allowed boolean, retry_after_seconds integer, remaining integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_capacity numeric;
  v_refill_per_second numeric;
  v_tokens numeric;
  v_updated_at timestamptz;
  v_now timestamptz;
  v_available numeric;
begin
  if p_subject_key is null or char_length(p_subject_key) not between 16 and 128 then
    raise exception 'A valid rate limit subject is required.' using errcode = '22023';
  end if;

  case p_scope
    when 'mcp_user' then
      v_capacity := 60;
      v_refill_per_second := 1;
    when 'mcp_ip' then
      v_capacity := 60;
      v_refill_per_second := 1;
    when 'checkout_user' then
      v_capacity := 3;
      v_refill_per_second := 1.0 / 60.0;
    when 'conversation_user' then
      v_capacity := 5;
      v_refill_per_second := 1.0 / 60.0;
    else
      raise exception 'Unknown rate limit scope.' using errcode = '22023';
  end case;

  insert into public.api_rate_limit_buckets(scope, subject_key, tokens, updated_at)
  values (p_scope, p_subject_key, v_capacity, clock_timestamp())
  on conflict (scope, subject_key) do nothing;

  select b.tokens, b.updated_at
    into v_tokens, v_updated_at
    from public.api_rate_limit_buckets b
   where b.scope = p_scope and b.subject_key = p_subject_key
   for update;

  v_now := clock_timestamp();
  v_available := least(
    v_capacity,
    v_tokens + greatest(0, extract(epoch from (v_now - v_updated_at))) * v_refill_per_second
  );

  if v_available < 1 then
    update public.api_rate_limit_buckets
       set tokens = v_available, updated_at = v_now
     where scope = p_scope and subject_key = p_subject_key;
    return query select false,
      greatest(1, ceil((1 - v_available) / v_refill_per_second)::integer),
      floor(v_available)::integer;
    return;
  end if;

  update public.api_rate_limit_buckets
     set tokens = v_available - 1, updated_at = v_now
   where scope = p_scope and subject_key = p_subject_key;

  -- Keep anonymous-IP fingerprints for at most a week without a platform cron.
  if random() < 0.01 then
    delete from public.api_rate_limit_buckets
     where updated_at < v_now - interval '7 days';
  end if;

  return query select true, 0, floor(v_available - 1)::integer;
end;
$$;
revoke all on function public.consume_api_rate_limit(text, text) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text) to service_role;

-- Serialize pending attempts by member and product. The API returns an existing
-- hosted checkout session when possible, and this trigger closes concurrent races.
create or replace function public.enforce_single_pending_checkout()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.payment_status <> 'pending' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || ':' || new.product_id::text, 0));

  if exists (
    select 1 from public.orders o
     where o.user_id = new.user_id
       and o.product_id = new.product_id
       and o.payment_status = 'pending'
       and o.id <> new.id
  ) then
    raise exception 'A pending checkout already exists for this product.' using errcode = '23505';
  end if;

  return new;
end;
$$;
drop trigger if exists orders_single_pending_checkout on public.orders;
create trigger orders_single_pending_checkout
before insert or update of user_id, product_id, payment_status on public.orders
for each row execute function public.enforce_single_pending_checkout();
revoke all on function public.enforce_single_pending_checkout() from public, anon, authenticated;
grant execute on function public.enforce_single_pending_checkout() to service_role;
