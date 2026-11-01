create table public.growth_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  details text not null default '' check (char_length(details) <= 1000),
  due_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'completed', 'cancelled')),
  idempotency_key uuid not null,
  created_by uuid not null references public.profiles(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (contact_id, user_id)
    references public.msg_contacts(id, user_id) on delete cascade,
  unique (user_id, idempotency_key),
  check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create index growth_reminders_user_due_idx
  on public.growth_reminders (user_id, due_at)
  where status = 'draft';

alter table public.growth_reminders enable row level security;
revoke all on public.growth_reminders from public, anon, authenticated;
grant all on public.growth_reminders to service_role;

create function public.create_growth_reminder_draft(
  p_user_id uuid,
  p_actor_user_id uuid,
  p_contact_id uuid,
  p_title text,
  p_details text,
  p_due_at timestamptz,
  p_idempotency_key uuid,
  p_growth_enabled boolean
)
returns table (reminder_id uuid, status text, created_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_existing public.growth_reminders%rowtype;
  v_reminder_id uuid;
begin
  if p_growth_enabled is distinct from true then
    raise exception 'Growth tools are disabled.' using errcode = '55000';
  end if;
  if p_user_id is null or p_actor_user_id is distinct from p_user_id
    or not exists (
      select 1 from public.profiles where id = p_user_id and role = 'admin'
    )
  then
    raise exception 'Growth administrator required.' using errcode = '42501';
  end if;
  if p_title is null
    or char_length(btrim(p_title)) not between 1 and 140
    or char_length(coalesce(p_details, '')) > 1000
    or p_due_at is null
    or p_due_at > now() + interval '365 days'
    or p_idempotency_key is null
  then
    raise exception 'Invalid growth reminder draft.' using errcode = '22023';
  end if;
  if p_contact_id is not null and not exists (
    select 1 from public.msg_contacts
    where id = p_contact_id and user_id = p_user_id
  ) then
    raise exception 'Growth reminder contact not found.' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || p_idempotency_key::text, 0)
  );
  select r.* into v_existing
  from public.growth_reminders r
  where r.user_id = p_user_id and r.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.contact_id is distinct from p_contact_id
      or v_existing.title <> btrim(p_title)
      or v_existing.details <> coalesce(p_details, '')
      or v_existing.due_at <> p_due_at
    then
      raise exception 'Idempotency key reused with different reminder data.'
        using errcode = '22023';
    end if;
    return query select v_existing.id, v_existing.status, v_existing.created_at;
    return;
  end if;

  insert into public.growth_reminders (
    user_id, contact_id, title, details, due_at, status, idempotency_key, created_by
  )
  values (
    p_user_id, p_contact_id, btrim(p_title), coalesce(p_details, ''),
    p_due_at, 'draft', p_idempotency_key, p_actor_user_id
  )
  returning id into v_reminder_id;

  insert into public.msg_audit_log (
    user_id, contact_id, actor_user_id, action, entity_type, entity_id, details
  )
  values (
    p_user_id, p_contact_id, p_actor_user_id, 'growth.reminder.drafted',
    'growth_reminder', v_reminder_id,
    jsonb_build_object('title_chars', char_length(btrim(p_title)), 'due_at', p_due_at)
  );

  return query
    select r.id, r.status, r.created_at
    from public.growth_reminders r
    where r.id = v_reminder_id;
end;
$$;

create function public.update_growth_reminder_draft(
  p_user_id uuid,
  p_actor_user_id uuid,
  p_reminder_id uuid,
  p_action text,
  p_growth_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_reminder public.growth_reminders%rowtype;
begin
  if p_growth_enabled is distinct from true then
    raise exception 'Growth tools are disabled.' using errcode = '55000';
  end if;
  if p_user_id is null or p_actor_user_id is distinct from p_user_id
    or not exists (
      select 1 from public.profiles where id = p_user_id and role = 'admin'
    )
  then
    raise exception 'Growth administrator required.' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('complete', 'cancel') then
    raise exception 'Invalid reminder action.' using errcode = '22023';
  end if;

  update public.growth_reminders r
  set status = case when p_action = 'complete' then 'completed' else 'cancelled' end,
      completed_at = case when p_action = 'complete' then clock_timestamp() end,
      updated_at = clock_timestamp()
  where r.id = p_reminder_id
    and r.user_id = p_user_id
    and r.status = 'draft'
  returning r.* into v_reminder;
  if not found then return false; end if;

  insert into public.msg_audit_log (
    user_id, contact_id, actor_user_id, action, entity_type, entity_id, details
  )
  values (
    p_user_id, v_reminder.contact_id, p_actor_user_id,
    case when p_action = 'complete' then 'growth.reminder.completed'
      else 'growth.reminder.cancelled' end,
    'growth_reminder', v_reminder.id, '{}'::jsonb
  );
  return true;
end;
$$;

create function public.get_growth_metrics(
  p_user_id uuid,
  p_since timestamptz,
  p_growth_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_contacts jsonb;
  v_followups jsonb;
  v_metrics jsonb;
begin
  if p_growth_enabled is distinct from true then
    raise exception 'Growth tools are disabled.' using errcode = '55000';
  end if;
  if p_user_id is null
    or p_since is null
    or p_since > now()
    or p_since < now() - interval '365 days'
    or not exists (
      select 1 from public.profiles where id = p_user_id and role = 'admin'
    )
  then
    raise exception 'Growth administrator required.' using errcode = '42501';
  end if;

  select coalesce(jsonb_object_agg(channel, counts), '{}'::jsonb)
  into v_contacts
  from (
    select c.channel,
      jsonb_build_object(
        'total', count(*),
        'consented', count(*) filter (
          where c.consent_given and c.consent_at is not null and c.status <> 'opted_out'
        ),
        'opted_out', count(*) filter (where c.status = 'opted_out')
      ) as counts
    from public.msg_contacts c
    where c.user_id = p_user_id
    group by c.channel
  ) channel_counts;

  select coalesce(jsonb_object_agg(status, total), '{}'::jsonb)
  into v_followups
  from (
    select f.status, count(*) as total
    from public.msg_followups f
    where f.user_id = p_user_id
    group by f.status
  ) followup_counts;

  select jsonb_build_object(
    'since', p_since,
    'contacts_by_channel', v_contacts,
    'inbound_messages', (
      select count(*) from public.msg_messages m
      where m.user_id = p_user_id and m.direction = 'inbound'
        and m.created_at >= p_since
    ),
    'sent_messages', (
      select count(*) from public.msg_messages m
      where m.user_id = p_user_id and m.direction = 'outbound'
        and m.status in ('sent', 'delivered', 'read') and m.sent_at >= p_since
    ),
    'followups_by_status', v_followups,
    'reminder_drafts', (
      select count(*) from public.growth_reminders r
      where r.user_id = p_user_id and r.status = 'draft'
    ),
    'overdue_reminder_drafts', (
      select count(*) from public.growth_reminders r
      where r.user_id = p_user_id and r.status = 'draft' and r.due_at < now()
    )
  ) into v_metrics;

  return v_metrics;
end;
$$;

revoke all on function public.create_growth_reminder_draft(uuid, uuid, uuid, text, text, timestamptz, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.create_growth_reminder_draft(uuid, uuid, uuid, text, text, timestamptz, uuid, boolean)
  to service_role;
revoke all on function public.update_growth_reminder_draft(uuid, uuid, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.update_growth_reminder_draft(uuid, uuid, uuid, text, boolean)
  to service_role;
revoke all on function public.get_growth_metrics(uuid, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.get_growth_metrics(uuid, timestamptz, boolean)
  to service_role;
