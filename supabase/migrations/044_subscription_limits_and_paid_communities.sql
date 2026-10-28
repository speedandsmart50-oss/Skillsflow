-- Subscription limits, skill selection and paid private communities.
create table if not exists public.member_subscription_skills (
  subscription_id uuid not null references public.member_subscriptions(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  selected_at timestamptz not null default now(),
  primary key (subscription_id, skill_id)
);

alter table public.member_subscription_skills enable row level security;
drop policy if exists "Members can read own subscription skills" on public.member_subscription_skills;
create policy "Members can read own subscription skills" on public.member_subscription_skills
  for select using (
    exists (
      select 1 from public.member_subscriptions ms
      where ms.id = subscription_id and ms.user_id = auth.uid()
    )
  );
revoke all on public.member_subscription_skills from anon, authenticated;
grant select on public.member_subscription_skills to authenticated;
grant all on public.member_subscription_skills to service_role;

create or replace function public.subscription_skill_limit(p_plan_slug text)
returns integer
language sql immutable
as $$
  select case
    when p_plan_slug = 'skillflow-plus' then 1
    when p_plan_slug = 'skillflow-pro' then 2
    when p_plan_slug = 'skillflow-max' then 3
    else 0
  end;
$$;

create or replace function public.set_member_subscription_skills(
  p_user_id uuid,
  p_skill_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subscription public.member_subscriptions%rowtype;
  v_limit integer;
  v_ids uuid[] := coalesce(p_skill_ids, '{}'::uuid[]);
  v_count integer;
begin
  if auth.uid() is distinct from p_user_id and auth.role() <> 'service_role' then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  select * into v_subscription
  from public.member_subscriptions
  where user_id = p_user_id
    and status = 'active'
    and ends_at > now()
  order by ends_at desc
  limit 1
  for update;

  if not found then
    raise exception 'Active subscription required' using errcode = '42501';
  end if;

  select count(*) into v_count from (select distinct unnest(v_ids) as id) selected;
  v_limit := public.subscription_skill_limit(v_subscription.plan_slug);

  if v_count < 1 or v_count > v_limit then
    raise exception 'Invalid skill selection' using errcode = '22023';
  end if;

  if exists (
    select 1
    from (select distinct unnest(v_ids) as id) selected
    left join public.skills s on s.id = selected.id and s.is_active
    where s.id is null
  ) then
    raise exception 'Skill unavailable' using errcode = '22023';
  end if;

  delete from public.member_subscription_skills
  where subscription_id = v_subscription.id;

  insert into public.member_subscription_skills (subscription_id, skill_id)
  select v_subscription.id, selected.id
  from (select distinct unnest(v_ids) as id) selected;

  return jsonb_build_object(
    'subscriptionId', v_subscription.id,
    'planSlug', v_subscription.plan_slug,
    'limit', v_limit,
    'skillIds', to_jsonb(v_ids)
  );
end;
$$;

revoke all on function public.subscription_skill_limit(text) from public, anon, authenticated;
grant execute on function public.subscription_skill_limit(text) to authenticated, service_role;
revoke all on function public.set_member_subscription_skills(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.set_member_subscription_skills(uuid, uuid[]) to authenticated, service_role;

create or replace function public.can_access_skill(p_user_id uuid, p_skill_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select (auth.uid() = p_user_id or auth.role() = 'service_role') and exists (
    select 1 from public.skills s
    where s.id = p_skill_id
      and s.is_active
      and (
        exists (
          select 1 from public.member_subscription_skills mss
          join public.member_subscriptions ms on ms.id = mss.subscription_id
          where mss.skill_id = s.id
            and ms.user_id = p_user_id
            and ms.status = 'active'
            and ms.ends_at > now()
        )
        or exists (
          select 1 from public.member_skills msk
          where msk.user_id = p_user_id
            and msk.skill_id = s.id
            and msk.status = 'active'
            and (msk.expires_at is null or msk.expires_at > now())
        )
        or exists (
          select 1 from public.entitlements e
          where e.user_id = p_user_id
            and e.product_id = s.product_id
            and e.status = 'active'
        )
      )
  );
$$;

create or replace function public.has_active_member_subscription(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select (auth.uid() = p_user_id or auth.role() = 'service_role')
    and exists (
      select 1 from public.member_subscriptions
      where user_id = p_user_id and status = 'active' and ends_at > now()
    );
$$;

revoke all on function public.has_active_member_subscription(uuid) from public, anon, authenticated;
grant execute on function public.has_active_member_subscription(uuid) to authenticated, service_role;

create or replace function public.member_is_community_member(p_community_id uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$
  select auth.uid() is not null
    and public.has_active_member_subscription(auth.uid())
    and exists (
      select 1 from public.member_community_memberships m
      where m.community_id = p_community_id and m.user_id = auth.uid()
    );
$$;

create or replace function public.member_manages_community(p_community_id uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$
  select auth.uid() is not null
    and public.has_active_member_subscription(auth.uid())
    and exists (
      select 1 from public.member_community_memberships m
      where m.community_id = p_community_id
        and m.user_id = auth.uid()
        and m.member_role in ('owner', 'manager')
    );
$$;

revoke all on function public.member_is_community_member(uuid), public.member_manages_community(uuid) from public, anon, authenticated;
grant execute on function public.member_is_community_member(uuid), public.member_manages_community(uuid) to authenticated;

