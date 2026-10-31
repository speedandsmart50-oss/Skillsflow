-- Add an IP-based rate limit scope for server-side authentication flows
-- (OTP consumption, OAuth authorization-code / token exchange).

alter table public.api_rate_limit_buckets
  drop constraint api_rate_limit_buckets_scope_check;

alter table public.api_rate_limit_buckets
  add constraint api_rate_limit_buckets_scope_check
  check (scope in ('mcp_user', 'mcp_ip', 'checkout_user', 'conversation_user', 'auth_ip'));

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
    when 'auth_ip' then
      v_capacity := 10;
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
