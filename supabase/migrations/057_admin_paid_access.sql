-- Administrators retain paid-member access without fabricated purchases or subscriptions.
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
          select 1 from public.profiles p
          where p.id = p_user_id and p.role = 'admin'
        )
        or exists (
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
    and (
      exists (
        select 1 from public.profiles p
        where p.id = p_user_id and p.role = 'admin'
      )
      or exists (
        select 1 from public.member_subscriptions
        where user_id = p_user_id and status = 'active' and ends_at > now()
      )
    );
$$;

revoke all on function public.has_active_member_subscription(uuid) from public, anon, authenticated;
grant execute on function public.has_active_member_subscription(uuid) to authenticated, service_role;
