create table public.msg_webhook_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel = 'whatsapp'),
  event_hash text not null check (event_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb not null check (jsonb_typeof(payload) = 'array'),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'processed', 'failed')),
  claim_token uuid,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  error_code text check (error_code is null or char_length(error_code) <= 120),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  unique (user_id, channel, event_hash),
  check (
    (status = 'processing' and claim_token is not null and claimed_at is not null
      and claim_expires_at is not null and claim_expires_at > claimed_at)
    or (status <> 'processing' and claim_token is null and claimed_at is null
      and claim_expires_at is null)
  )
);

create index msg_webhook_events_pending_idx
  on public.msg_webhook_events (status, received_at)
  where status in ('pending', 'failed');
create index msg_webhook_events_expiry_idx
  on public.msg_webhook_events (expires_at);

alter table public.msg_webhook_events enable row level security;
revoke all on public.msg_webhook_events from public, anon, authenticated;
grant all on public.msg_webhook_events to service_role;

create function public.record_inbound_whatsapp_message(
  p_user_id uuid,
  p_external_contact_id text,
  p_display_name text,
  p_external_message_id text,
  p_content text,
  p_received_at timestamptz,
  p_opt_out boolean
)
returns table (contact_id uuid, message_id uuid, inserted boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_contact_id uuid;
  v_message_id uuid;
begin
  if p_user_id is null
    or p_external_contact_id is null
    or char_length(btrim(p_external_contact_id)) not between 1 and 255
    or p_external_message_id is null
    or char_length(p_external_message_id) not between 1 and 255
    or p_received_at is null
    or char_length(coalesce(p_display_name, '')) > 200
    or char_length(coalesce(p_content, '')) > 30000
    or p_opt_out is null
  then
    raise exception 'Invalid WhatsApp inbound message.' using errcode = '22023';
  end if;

  insert into public.msg_contacts (
    user_id, channel, external_contact_id, display_name, status, last_inbound_at
  )
  values (
    p_user_id, 'whatsapp', btrim(p_external_contact_id), nullif(p_display_name, ''),
    case when p_opt_out then 'opted_out' else 'new' end, p_received_at
  )
  on conflict (user_id, channel, external_contact_id) do update
  set display_name = coalesce(nullif(excluded.display_name, ''), msg_contacts.display_name),
      status = case when p_opt_out then 'opted_out' else msg_contacts.status end,
      last_inbound_at = greatest(msg_contacts.last_inbound_at, excluded.last_inbound_at),
      updated_at = now()
  returning id into v_contact_id;

  insert into public.msg_messages (
    user_id, contact_id, channel, direction, content, message_type,
    source_event_type, source_event_id, external_message_id, status, created_at
  )
  values (
    p_user_id, v_contact_id, 'whatsapp', 'inbound', coalesce(p_content, ''), 'free',
    'message', p_external_message_id, p_external_message_id, 'received', p_received_at
  )
  on conflict (user_id, channel, external_message_id) do nothing
  returning id into v_message_id;

  if v_message_id is not null and p_opt_out then
    insert into public.msg_audit_log (
      user_id, contact_id, action, entity_type, entity_id, details
    )
    values (
      p_user_id, v_contact_id, 'contact.opt_out', 'contact', v_contact_id, '{}'::jsonb
    );
  end if;

  return query select v_contact_id, v_message_id, v_message_id is not null;
end;
$$;

revoke all on function public.record_inbound_whatsapp_message(uuid, text, text, text, text, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.record_inbound_whatsapp_message(uuid, text, text, text, text, timestamptz, boolean)
  to service_role;

create function public.apply_whatsapp_message_status(
  p_user_id uuid,
  p_external_message_id text,
  p_status text,
  p_error_code text,
  p_status_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user_id is null
    or p_external_message_id is null
    or char_length(p_external_message_id) not between 1 and 255
    or p_status is null
    or p_status not in ('sent', 'delivered', 'read', 'failed')
    or char_length(coalesce(p_error_code, '')) > 120
    or p_status_at is null
  then
    raise exception 'Invalid WhatsApp message status.' using errcode = '22023';
  end if;

  update public.msg_messages
  set status = case
        when status in ('delivered', 'read', 'failed') then status
        when p_status = 'read' then 'read'
        when p_status = 'delivered' then 'delivered'
        when p_status = 'sent' and status in ('approved', 'sent') then 'sent'
        when p_status = 'failed' and status in ('approved', 'sent') then 'failed'
        else status
      end,
      error_code = case
        when p_status = 'failed' and status in ('approved', 'sent') then p_error_code
        else error_code
      end,
      sent_at = coalesce(sent_at, p_status_at),
      updated_at = now()
  where user_id = p_user_id
    and channel = 'whatsapp'
    and direction = 'outbound'
    and external_message_id = p_external_message_id;

  return found;
end;
$$;

revoke all on function public.apply_whatsapp_message_status(uuid, text, text, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.apply_whatsapp_message_status(uuid, text, text, text, timestamptz)
  to service_role;
