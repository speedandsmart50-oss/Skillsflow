alter table public.msg_messages
  add constraint msg_messages_id_user_uq unique (id, user_id);

alter table public.msg_followups
  add column due_at timestamptz,
  add column jitter_seconds integer not null default 0
    check (jitter_seconds between 0 and 900),
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles(id) on delete set null,
  add column template_language text
    check (template_language is null or char_length(template_language) between 1 and 32),
  add column idempotency_key uuid,
  add column result_message_id uuid;

update public.msg_followups
set due_at = scheduled_at,
    status = case
      when status = 'scheduled' then 'draft'
      when status = 'processing' then 'failed'
      else status
    end,
    cancellation_reason = case
      when status = 'processing' then 'legacy_processing_requires_review'
      else cancellation_reason
    end,
    claimed_at = null,
    claim_expires_at = null,
    claim_token = null;

alter table public.msg_followups
  alter column due_at set not null,
  alter column due_at set default now(),
  drop constraint msg_followups_status_check,
  drop constraint msg_followups_message_content_check,
  drop constraint msg_followups_template_name_check,
  add constraint msg_followups_status_check
    check (status in ('draft', 'scheduled', 'processing', 'awaiting_approval', 'sent', 'cancelled', 'failed')),
  add constraint msg_followups_message_content_check
    check (
      (message_type = 'free' and char_length(btrim(message_content)) between 1 and 4096)
      or (message_type = 'template' and message_content = '')
    ),
  add constraint msg_followups_template_name_check
    check (
      (message_type = 'free' and template_name is null and template_language is null)
      or (
        message_type = 'template'
        and template_name is not null
        and template_name ~ '^[a-z0-9_]{1,512}$'
        and template_language is not null
        and template_language ~ '^[A-Za-z0-9_-]{1,32}$'
      )
    ),
  add constraint msg_followups_approval_state_check
    check (
      (status in ('scheduled', 'processing', 'awaiting_approval')
        and approved_at is not null and approved_by is not null)
      or (status = 'sent' and (
        (approved_at is not null and approved_by is not null)
        or (approved_at is null and approved_by is null)
      ))
      or (status not in ('scheduled', 'processing', 'awaiting_approval', 'sent')
        and approved_at is null and approved_by is null)
    ),
  add constraint msg_followups_result_message_check
    check (
      (status = 'awaiting_approval' and result_message_id is not null)
      or (status = 'sent')
      or (status not in ('awaiting_approval', 'sent') and result_message_id is null)
    ),
  add constraint msg_followups_idempotency_key_uq unique (user_id, idempotency_key),
  add constraint msg_followups_result_message_id_fkey
    foreign key (result_message_id, user_id)
      references public.msg_messages(id, user_id);

create index msg_followups_due_at_idx
  on public.msg_followups (status, due_at)
  where status = 'scheduled';

create function public.create_whatsapp_followup_draft(
  p_user_id uuid,
  p_actor_user_id uuid,
  p_contact_id uuid,
  p_scheduled_at timestamptz,
  p_message_type text,
  p_message_content text,
  p_template_name text,
  p_template_language text,
  p_idempotency_key uuid,
  p_messaging_enabled boolean
)
returns table (followup_id uuid, due_at timestamptz, jitter_seconds integer, status text)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_existing public.msg_followups%rowtype;
  v_followup_id uuid;
  v_jitter_seconds integer;
  v_due_at timestamptz;
  v_content text;
begin
  if p_messaging_enabled is distinct from true then
    raise exception 'Messaging is disabled.' using errcode = '55000';
  end if;

  if p_user_id is null or p_actor_user_id is distinct from p_user_id
    or not exists (
      select 1 from public.profiles
      where id = p_user_id and role = 'admin'
    )
  then
    raise exception 'Messaging administrator required.' using errcode = '42501';
  end if;

  if p_contact_id is null
    or p_scheduled_at is null
    or p_scheduled_at < v_now
    or p_scheduled_at > v_now + interval '90 days'
    or p_idempotency_key is null
    or p_message_type is null
  then
    raise exception 'Invalid follow-up schedule.' using errcode = '22023';
  end if;

  if p_message_type = 'free' then
    if p_message_content is null
      or char_length(btrim(p_message_content)) not between 1 and 4096
      or p_template_name is not null
      or p_template_language is not null
    then
      raise exception 'Invalid free-form follow-up.' using errcode = '22023';
    end if;
    v_content := btrim(p_message_content);
  elsif p_message_type = 'template' then
    if p_message_content is not null
      or p_template_name is null
      or p_template_name !~ '^[a-z0-9_]{1,512}$'
      or p_template_language is null
      or p_template_language !~ '^[A-Za-z0-9_-]{1,32}$'
    then
      raise exception 'Invalid template follow-up.' using errcode = '22023';
    end if;
    v_content := '';
  else
    raise exception 'Unsupported follow-up type.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.msg_contacts
    where id = p_contact_id
      and user_id = p_user_id
      and channel = 'whatsapp'
  ) then
    raise exception 'WhatsApp contact not found.' using errcode = 'P0002';
  end if;

  select f.*
    into v_existing
  from public.msg_followups f
  where f.user_id = p_user_id
    and f.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.contact_id <> p_contact_id
      or v_existing.scheduled_at <> p_scheduled_at
      or v_existing.message_type <> p_message_type
      or v_existing.message_content <> v_content
      or v_existing.template_name is distinct from p_template_name
      or v_existing.template_language is distinct from p_template_language
    then
      raise exception 'Idempotency key reused with different follow-up data.' using errcode = '22023';
    end if;
    return query select v_existing.id, v_existing.due_at, v_existing.jitter_seconds, v_existing.status;
    return;
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_user_id::text || p_idempotency_key::text, 0)
  );
  select f.*
    into v_existing
  from public.msg_followups f
  where f.user_id = p_user_id
    and f.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.contact_id <> p_contact_id
      or v_existing.scheduled_at <> p_scheduled_at
      or v_existing.message_type <> p_message_type
      or v_existing.message_content <> v_content
      or v_existing.template_name is distinct from p_template_name
      or v_existing.template_language is distinct from p_template_language
    then
      raise exception 'Idempotency key reused with different follow-up data.' using errcode = '22023';
    end if;
    return query select v_existing.id, v_existing.due_at, v_existing.jitter_seconds, v_existing.status;
    return;
  end if;

  v_jitter_seconds := floor(random() * 901)::integer;
  v_due_at := p_scheduled_at + make_interval(secs => v_jitter_seconds);

  insert into public.msg_followups (
    user_id, contact_id, message_content, message_type, template_name,
    template_language, scheduled_at, due_at, jitter_seconds, status, idempotency_key
  )
  values (
    p_user_id, p_contact_id, v_content, p_message_type, p_template_name,
    p_template_language, p_scheduled_at, v_due_at, v_jitter_seconds, 'draft', p_idempotency_key
  )
  returning id into v_followup_id;

  insert into public.msg_audit_log (
    user_id, contact_id, actor_user_id, action, entity_type, entity_id, details
  )
  values (
    p_user_id, p_contact_id, p_actor_user_id, 'followup.drafted', 'followup', v_followup_id,
    jsonb_build_object(
      'scheduled_at', p_scheduled_at,
      'due_at', v_due_at,
      'jitter_seconds', v_jitter_seconds,
      'message_type', p_message_type
    )
  );

  return query select v_followup_id, v_due_at, v_jitter_seconds, 'draft'::text;
end;
$$;

create function public.approve_whatsapp_followup(
  p_user_id uuid,
  p_actor_user_id uuid,
  p_followup_id uuid,
  p_messaging_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_followup public.msg_followups%rowtype;
begin
  if p_messaging_enabled is distinct from true then
    raise exception 'Messaging is disabled.' using errcode = '55000';
  end if;
  if p_user_id is null or p_actor_user_id is distinct from p_user_id
    or not exists (select 1 from public.profiles where id = p_user_id and role = 'admin')
  then
    raise exception 'Messaging administrator required.' using errcode = '42501';
  end if;

  update public.msg_followups f
  set status = 'scheduled',
      approved_at = v_now,
      approved_by = p_actor_user_id,
      due_at = greatest(f.due_at, v_now),
      updated_at = v_now
  where f.id = p_followup_id
    and f.user_id = p_user_id
    and f.status = 'draft'
  returning f.* into v_followup;
  if not found then return false; end if;

  insert into public.msg_audit_log (
    user_id, contact_id, actor_user_id, action, entity_type, entity_id, details
  )
  values (
    p_user_id, v_followup.contact_id, p_actor_user_id, 'followup.approved',
    'followup', v_followup.id,
    jsonb_build_object(
      'scheduled_at', v_followup.scheduled_at,
      'due_at', v_followup.due_at,
      'jitter_seconds', v_followup.jitter_seconds
    )
  );
  return true;
end;
$$;

create function public.cancel_whatsapp_followup(
  p_user_id uuid,
  p_actor_user_id uuid,
  p_followup_id uuid,
  p_messaging_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_followup public.msg_followups%rowtype;
begin
  if p_messaging_enabled is distinct from true then
    raise exception 'Messaging is disabled.' using errcode = '55000';
  end if;
  if p_user_id is null or p_actor_user_id is distinct from p_user_id
    or not exists (select 1 from public.profiles where id = p_user_id and role = 'admin')
  then
    raise exception 'Messaging administrator required.' using errcode = '42501';
  end if;

  update public.msg_followups f
  set status = 'cancelled',
      cancellation_reason = 'cancelled_by_administrator',
      result_message_id = null,
      approved_at = null,
      approved_by = null,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      updated_at = clock_timestamp()
  where f.id = p_followup_id
    and f.user_id = p_user_id
    and f.status in ('draft', 'scheduled', 'awaiting_approval')
  returning f.* into v_followup;
  if not found then return false; end if;

  insert into public.msg_audit_log (
    user_id, contact_id, actor_user_id, action, entity_type, entity_id, details
  )
  values (
    p_user_id, v_followup.contact_id, p_actor_user_id, 'followup.cancelled',
    'followup', v_followup.id, '{}'::jsonb
  );
  return true;
end;
$$;

create function public.claim_due_whatsapp_followups(
  p_limit integer,
  p_messaging_enabled boolean
)
returns table (
  id uuid,
  user_id uuid,
  contact_id uuid,
  message_content text,
  message_type text,
  template_name text,
  template_language text,
  approved_by uuid,
  claim_token uuid
)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
begin
  if p_messaging_enabled is distinct from true then
    return;
  end if;
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'Invalid follow-up claim limit.' using errcode = '22023';
  end if;

  with expired as (
    update public.msg_followups f
    set status = 'failed',
        cancellation_reason = 'claim_expired_requires_manual_review',
        approved_at = null,
        approved_by = null,
        claim_token = null,
        claimed_at = null,
        claim_expires_at = null,
        updated_at = v_now
    where f.status = 'processing'
      and f.claim_expires_at <= v_now
    returning f.id, f.user_id, f.contact_id
  )
  insert into public.msg_audit_log (
    user_id, contact_id, action, entity_type, entity_id, details
  )
  select e.user_id, e.contact_id, 'followup.claim_expired', 'followup', e.id,
    jsonb_build_object('reason', 'manual_review_required')
  from expired e;

  return query
  with candidates as (
    select f.id
    from public.msg_followups f
    where f.status = 'scheduled'
      and f.due_at <= v_now
      and f.approved_at is not null
      and f.approved_by is not null
    order by f.due_at, f.id
    for update skip locked
    limit p_limit
  ),
  claimed as (
    update public.msg_followups f
    set status = 'processing',
        claim_token = gen_random_uuid(),
        claimed_at = v_now,
        claim_expires_at = v_now + interval '5 minutes',
        attempt_count = attempt_count + 1,
        updated_at = v_now
    from candidates c
    where f.id = c.id
    returning f.id, f.user_id, f.contact_id, f.message_content,
      f.message_type, f.template_name, f.template_language, f.approved_by, f.claim_token
  )
  select c.id, c.user_id, c.contact_id, c.message_content,
    c.message_type, c.template_name, c.template_language, c.approved_by, c.claim_token
  from claimed c;
end;
$$;

create function public.complete_whatsapp_followup(
  p_followup_id uuid,
  p_claim_token uuid,
  p_status text,
  p_reason text,
  p_result_message_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_followup public.msg_followups%rowtype;
  v_action text;
begin
  if p_followup_id is null or p_claim_token is null
    or p_status is null
    or p_status not in ('sent', 'awaiting_approval', 'cancelled', 'failed')
    or char_length(coalesce(p_reason, '')) > 500
    or (p_status in ('sent', 'awaiting_approval') and p_result_message_id is null)
    or (p_status not in ('sent', 'awaiting_approval') and p_result_message_id is not null)
  then
    raise exception 'Invalid follow-up completion.' using errcode = '22023';
  end if;

  update public.msg_followups f
  set status = p_status,
      cancellation_reason = nullif(p_reason, ''),
      result_message_id = p_result_message_id,
      approved_at = case when p_status in ('sent', 'awaiting_approval') then f.approved_at end,
      approved_by = case when p_status in ('sent', 'awaiting_approval') then f.approved_by end,
      claim_token = null,
      claimed_at = null,
      claim_expires_at = null,
      updated_at = clock_timestamp()
  where f.id = p_followup_id
    and f.status = 'processing'
    and f.claim_token = p_claim_token
    and (
      p_status <> 'sent'
      or exists (
        select 1 from public.msg_messages m
        where m.id = p_result_message_id
          and m.user_id = f.user_id
          and m.contact_id = f.contact_id
          and m.channel = 'whatsapp'
          and m.direction = 'outbound'
          and m.status = 'sent'
      )
    )
    and (
      p_status <> 'awaiting_approval'
      or exists (
        select 1 from public.msg_messages m
        where m.id = p_result_message_id
          and m.user_id = f.user_id
          and m.contact_id = f.contact_id
          and m.channel = 'whatsapp'
          and m.direction = 'outbound'
          and m.status = 'draft'
      )
    )
  returning f.* into v_followup;
  if not found then return false; end if;

  v_action := case p_status
    when 'awaiting_approval' then 'followup.draft_ready'
    when 'sent' then 'followup.sent'
    when 'cancelled' then 'followup.cancelled'
    else 'followup.failed'
  end;
  insert into public.msg_audit_log (
    user_id, contact_id, actor_user_id, action, entity_type, entity_id, details
  )
  values (
    v_followup.user_id, v_followup.contact_id, v_followup.approved_by,
    v_action, 'followup', v_followup.id,
    jsonb_build_object(
      'reason', nullif(p_reason, ''),
      'result_message_id', p_result_message_id,
      'jitter_seconds', v_followup.jitter_seconds
    )
  );
  return true;
end;
$$;

create function public.approve_whatsapp_followup_draft(
  p_user_id uuid,
  p_actor_user_id uuid,
  p_followup_id uuid,
  p_messaging_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_followup public.msg_followups%rowtype;
begin
  if p_messaging_enabled is distinct from true then
    raise exception 'Messaging is disabled.' using errcode = '55000';
  end if;
  if p_user_id is null or p_actor_user_id is distinct from p_user_id
    or not exists (select 1 from public.profiles where id = p_user_id and role = 'admin')
  then
    raise exception 'Messaging administrator required.' using errcode = '42501';
  end if;

  update public.msg_followups f
  set status = 'sent',
      approved_at = clock_timestamp(),
      approved_by = p_actor_user_id,
      cancellation_reason = null,
      updated_at = clock_timestamp()
  where f.id = p_followup_id
    and f.user_id = p_user_id
    and f.status = 'awaiting_approval'
    and exists (
      select 1 from public.msg_messages m
      where m.id = f.result_message_id
        and m.user_id = f.user_id
        and m.contact_id = f.contact_id
        and m.channel = 'whatsapp'
        and m.direction = 'outbound'
        and m.status = 'sent'
    )
  returning f.* into v_followup;
  if not found then return false; end if;

  insert into public.msg_audit_log (
    user_id, contact_id, actor_user_id, action, entity_type, entity_id, details
  )
  values (
    p_user_id, v_followup.contact_id, p_actor_user_id, 'followup.draft_approved',
    'followup', v_followup.id,
    jsonb_build_object('message_id', v_followup.result_message_id)
  );
  return true;
end;
$$;

create function public.fail_whatsapp_followup_draft(
  p_user_id uuid,
  p_actor_user_id uuid,
  p_followup_id uuid,
  p_message_id uuid,
  p_messaging_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_followup public.msg_followups%rowtype;
begin
  if p_messaging_enabled is distinct from true then
    raise exception 'Messaging is disabled.' using errcode = '55000';
  end if;
  if p_user_id is null or p_actor_user_id is distinct from p_user_id
    or not exists (select 1 from public.profiles where id = p_user_id and role = 'admin')
  then
    raise exception 'Messaging administrator required.' using errcode = '42501';
  end if;

  update public.msg_followups f
  set status = 'failed',
      cancellation_reason = 'approved_draft_send_failed_requires_manual_review',
      result_message_id = null,
      approved_at = null,
      approved_by = null,
      updated_at = clock_timestamp()
  where f.id = p_followup_id
    and f.user_id = p_user_id
    and f.status = 'awaiting_approval'
    and f.result_message_id = p_message_id
  returning f.* into v_followup;
  if not found then return false; end if;

  insert into public.msg_audit_log (
    user_id, contact_id, actor_user_id, action, entity_type, entity_id, details
  )
  values (
    p_user_id, v_followup.contact_id, p_actor_user_id, 'followup.draft_send_failed',
    'followup', v_followup.id,
    jsonb_build_object('message_id', p_message_id, 'manual_review_required', true)
  );
  return true;
end;
$$;

revoke all on function public.create_whatsapp_followup_draft(uuid, uuid, uuid, timestamptz, text, text, text, text, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.create_whatsapp_followup_draft(uuid, uuid, uuid, timestamptz, text, text, text, text, uuid, boolean)
  to service_role;
revoke all on function public.approve_whatsapp_followup(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.approve_whatsapp_followup(uuid, uuid, uuid, boolean)
  to service_role;
revoke all on function public.cancel_whatsapp_followup(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.cancel_whatsapp_followup(uuid, uuid, uuid, boolean)
  to service_role;
revoke all on function public.approve_whatsapp_followup_draft(uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.approve_whatsapp_followup_draft(uuid, uuid, uuid, boolean)
  to service_role;
revoke all on function public.fail_whatsapp_followup_draft(uuid, uuid, uuid, uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.fail_whatsapp_followup_draft(uuid, uuid, uuid, uuid, boolean)
  to service_role;
revoke all on function public.claim_due_whatsapp_followups(integer, boolean)
  from public, anon, authenticated;
grant execute on function public.claim_due_whatsapp_followups(integer, boolean)
  to service_role;
revoke all on function public.complete_whatsapp_followup(uuid, uuid, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.complete_whatsapp_followup(uuid, uuid, text, text, uuid)
  to service_role;
