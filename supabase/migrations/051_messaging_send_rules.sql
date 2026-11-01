create table public.msg_approved_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel = 'whatsapp'),
  template_name text not null check (char_length(template_name) between 1 and 255),
  language text not null check (char_length(language) between 1 and 32),
  provider_template_id text check (
    provider_template_id is null or char_length(provider_template_id) between 1 and 255
  ),
  category text check (category is null or category in ('marketing', 'utility', 'authentication')),
  approval_status text not null default 'pending'
    check (approval_status in ('pending', 'approved', 'rejected', 'paused', 'disabled')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, channel, template_name, language)
);

create unique index msg_messages_id_user_channel_uq
  on public.msg_messages (id, user_id, channel);

create table public.msg_send_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null,
  message_id uuid not null unique,
  channel text not null check (channel = 'whatsapp'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  template_language text check (
    template_language is null or char_length(template_language) between 1 and 32
  ),
  created_at timestamptz not null default now(),
  foreign key (contact_id, user_id)
    references public.msg_contacts(id, user_id) on delete cascade,
  foreign key (message_id, user_id, channel)
    references public.msg_messages(id, user_id, channel) on delete cascade
);

create index msg_send_reservations_contact_created_idx
  on public.msg_send_reservations (user_id, contact_id, created_at desc);
create index msg_send_reservations_global_created_idx
  on public.msg_send_reservations (created_at desc);

alter table public.msg_approved_templates enable row level security;
alter table public.msg_send_reservations enable row level security;
revoke all on public.msg_approved_templates, public.msg_send_reservations
  from public, anon, authenticated;
grant all on public.msg_approved_templates, public.msg_send_reservations
  to service_role;

create function public.evaluate_messaging_send(
  p_user_id uuid,
  p_actor_user_id uuid,
  p_contact_id uuid,
  p_channel text,
  p_content text,
  p_message_type text,
  p_template_name text,
  p_template_language text,
  p_existing_message_id uuid,
  p_messaging_enabled boolean,
  p_dry_run boolean,
  p_live_send_enabled boolean,
  p_max_contact_per_day integer,
  p_max_outbound_per_hour integer
)
returns table (allowed boolean, reason text, message_id uuid, dry_run boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_contact public.msg_contacts%rowtype;
  v_existing_message public.msg_messages%rowtype;
  v_reason text;
  v_content_hash text;
  v_message_id uuid;
  v_outbound_today bigint;
  v_outbound_hour bigint;
  v_actor_user_id uuid;
begin
  if p_user_id is null or not exists (
    select 1 from public.profiles where id = p_user_id
  ) then
    return query select false, 'contact_not_found'::text, null::uuid, coalesce(p_dry_run, true);
    return;
  end if;

  if p_actor_user_id is not null and exists (
    select 1 from public.profiles where id = p_actor_user_id
  ) then
    v_actor_user_id := p_actor_user_id;
  end if;

  perform pg_advisory_xact_lock(731205, 1);

  if p_messaging_enabled is distinct from true then
    v_reason := 'messaging_disabled';
  elsif p_dry_run = false and p_live_send_enabled = false then
    v_reason := 'live_sending_disabled';
  elsif not exists (
    select 1 from public.profiles where id = p_user_id and role = 'admin'
  ) or not exists (
    select 1 from public.profiles where id = v_actor_user_id and role = 'admin'
  ) then
    v_reason := 'contact_not_found';
  elsif p_channel is distinct from 'whatsapp' then
    v_reason := 'channel_not_supported';
  elsif p_message_type is null or p_message_type not in ('free', 'template')
    or (p_message_type = 'free' and (
      p_content is null or char_length(btrim(p_content)) not between 1 and 4096
    ))
    or (p_message_type = 'template' and p_content is not null)
    or p_dry_run is null
    or p_live_send_enabled is null
    or p_max_contact_per_day is null
    or p_max_outbound_per_hour is null
    or p_max_contact_per_day not between 1 and 100
    or p_max_outbound_per_hour not between 1 and 10000
  then
    v_reason := 'invalid_message';
  elsif p_message_type = 'template'
    and (nullif(btrim(p_template_name), '') is null
      or nullif(btrim(p_template_language), '') is null
      or char_length(p_template_name) > 255
      or char_length(p_template_language) > 32)
  then
    v_reason := 'invalid_message';
  elsif p_message_type = 'free'
    and (p_template_name is not null or p_template_language is not null)
  then
    v_reason := 'invalid_message';
  else
    select c.*
      into v_contact
    from public.msg_contacts c
    where c.id = p_contact_id
      and c.user_id = p_user_id
    for update;

    if not found then
      v_reason := 'contact_not_found';
    elsif v_contact.status = 'opted_out' then
      v_reason := 'contact_opted_out';
    elsif v_contact.last_inbound_at is null or not exists (
      select 1
      from public.msg_messages m
      where m.contact_id = v_contact.id
        and m.user_id = p_user_id
        and m.direction = 'inbound'
    ) then
      v_reason := 'no_inbound_message';
    elsif not v_contact.consent_given
      or v_contact.consent_at is null
      or v_contact.consent_at > v_now
      or nullif(btrim(v_contact.consent_source), '') is null
    then
      v_reason := 'consent_required';
    elsif p_message_type = 'template' and not exists (
      select 1
      from public.msg_approved_templates t
      where t.user_id = p_user_id
        and t.channel = 'whatsapp'
        and t.template_name = btrim(p_template_name)
        and t.language = btrim(p_template_language)
        and t.provider_template_id is not null
        and t.approval_status = 'approved'
        and t.last_verified_at is not null
        and t.last_verified_at <= v_now
        and t.last_verified_at > v_now - interval '24 hours'
    ) then
      v_reason := 'template_not_approved';
    elsif v_contact.last_inbound_at > v_now then
      v_reason := 'no_inbound_message';
    elsif p_message_type = 'free'
      and v_contact.last_inbound_at <= v_now - interval '24 hours'
    then
      v_reason := 'outside_response_window';
    else
      v_content_hash := encode(
        pg_catalog.sha256(pg_catalog.convert_to(
          case when p_message_type = 'template'
            then 'template:' || btrim(p_template_name) || ':' || btrim(p_template_language)
            else 'free:' || p_content
          end,
          'UTF8'
        )),
        'hex'
      );

      if p_existing_message_id is not null then
        select m.*
          into v_existing_message
        from public.msg_messages m
        where m.id = p_existing_message_id
          and m.user_id = p_user_id
          and m.contact_id = v_contact.id
          and m.channel = 'whatsapp'
          and m.direction = 'outbound'
          and m.status = 'draft'
          and m.message_type = p_message_type
          and m.content = coalesce(p_content, '')
          and m.template_name is not distinct from
            case when p_message_type = 'template' then btrim(p_template_name) end
        for update;

        if not found or not exists (
          select 1
          from public.msg_send_reservations r
          where r.message_id = p_existing_message_id
            and r.user_id = p_user_id
            and r.contact_id = v_contact.id
            and r.content_hash = v_content_hash
            and r.template_language is not distinct from
              case when p_message_type = 'template' then btrim(p_template_language) end
        ) then
          v_reason := 'invalid_message';
        end if;
      end if;

      if v_reason is null then
        select count(*)
          into v_outbound_today
        from public.msg_send_reservations r
        where r.user_id = p_user_id
          and r.contact_id = v_contact.id
          and (p_existing_message_id is null or r.message_id <> p_existing_message_id)
          and r.created_at >= date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';

        if v_outbound_today >= p_max_contact_per_day then
          v_reason := 'rate_limit_exceeded';
        else
          select count(*)
            into v_outbound_hour
          from public.msg_send_reservations r
          where r.created_at > v_now - interval '1 hour'
            and (p_existing_message_id is null or r.message_id <> p_existing_message_id);

          if v_outbound_hour >= p_max_outbound_per_hour then
            v_reason := 'rate_limit_exceeded';
          else
            if exists (
              select 1
              from public.msg_send_reservations r
              where r.user_id = p_user_id
                and r.contact_id = v_contact.id
                and r.content_hash = v_content_hash
                and (p_existing_message_id is null or r.message_id <> p_existing_message_id)
                and r.created_at > v_now - interval '24 hours'
            ) then
              v_reason := 'duplicate_message';
            end if;
          end if;
        end if;
      end if;
    end if;
  end if;

  if v_reason is null then
    if p_existing_message_id is not null then
      v_message_id := p_existing_message_id;
      if not p_dry_run then
        update public.msg_messages
        set status = 'approved', updated_at = v_now
        where id = p_existing_message_id
          and user_id = p_user_id
          and status = 'draft';
        if not found then
          v_message_id := null;
          v_reason := 'invalid_message';
        end if;
      end if;
    else
      insert into public.msg_messages (
        user_id, contact_id, channel, direction, content, content_type,
        message_type, template_name, status
      )
      values (
        p_user_id, v_contact.id, 'whatsapp', 'outbound', coalesce(p_content, ''), 'text',
        p_message_type, case when p_message_type = 'template' then btrim(p_template_name) end,
        case when p_dry_run then 'draft' else 'approved' end
      )
      returning id into v_message_id;

      insert into public.msg_send_reservations (
        user_id, contact_id, message_id, channel, content_hash, template_language
      )
      values (
        p_user_id, v_contact.id, v_message_id, 'whatsapp', v_content_hash,
        case when p_message_type = 'template' then btrim(p_template_language) end
      );
    end if;
  end if;

  insert into public.msg_audit_log (
    user_id, contact_id, actor_user_id, action, entity_type, entity_id, details
  )
  values (
    p_user_id,
    case when v_contact.id is not null then v_contact.id else null end,
    v_actor_user_id,
    case when v_reason is null then 'send.allowed' else 'send.denied' end,
    case when v_message_id is null then 'contact' else 'message' end,
    coalesce(v_message_id, v_contact.id),
    jsonb_build_object(
      'channel', p_channel,
      'message_type', p_message_type,
      'template_name', case when p_message_type = 'template' then btrim(p_template_name) end,
      'template_language', case when p_message_type = 'template' then btrim(p_template_language) end,
      'reason', coalesce(v_reason, 'allowed'),
      'dry_run', coalesce(p_dry_run, true)
    )
  );

  return query select v_reason is null, coalesce(v_reason, 'allowed'), v_message_id, coalesce(p_dry_run, true);
end;
$$;

revoke all on function public.evaluate_messaging_send(uuid, uuid, uuid, text, text, text, text, text, uuid, boolean, boolean, boolean, integer, integer)
  from public, anon, authenticated;
grant execute on function public.evaluate_messaging_send(uuid, uuid, uuid, text, text, text, text, text, uuid, boolean, boolean, boolean, integer, integer)
  to service_role;
