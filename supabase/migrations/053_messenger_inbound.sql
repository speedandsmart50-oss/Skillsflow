alter table public.msg_webhook_events
  drop constraint if exists msg_webhook_events_channel_check,
  add constraint msg_webhook_events_channel_check
    check (channel in ('whatsapp', 'messenger'));

create function public.record_inbound_messenger_message(
  p_user_id uuid,
  p_external_contact_id text,
  p_external_message_id text,
  p_content text,
  p_content_type text,
  p_received_at timestamptz,
  p_opt_out boolean
)
returns table (contact_id uuid, message_id uuid, inserted boolean)
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
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
    or p_content_type is null
    or p_content_type not in ('text', 'non_text')
    or p_received_at is null
    or char_length(coalesce(p_content, '')) > 30000
    or (p_content_type = 'text' and nullif(btrim(p_content), '') is null)
    or (p_content_type = 'non_text' and coalesce(p_content, '') <> '')
    or p_opt_out is null
  then
    raise exception 'Invalid Messenger inbound message.' using errcode = '22023';
  end if;

  insert into public.msg_contacts (
    user_id, channel, external_contact_id, status, last_inbound_at
  )
  values (
    p_user_id, 'messenger', btrim(p_external_contact_id),
    case when p_opt_out then 'opted_out' else 'new' end, p_received_at
  )
  on conflict (user_id, channel, external_contact_id) do update
  set status = case when p_opt_out then 'opted_out' else msg_contacts.status end,
      last_inbound_at = greatest(msg_contacts.last_inbound_at, excluded.last_inbound_at),
      updated_at = now()
  returning id into v_contact_id;

  insert into public.msg_messages (
    user_id, contact_id, channel, direction, content, message_type,
    content_type, source_event_type, source_event_id, external_message_id,
    status, created_at
  )
  values (
    p_user_id, v_contact_id, 'messenger', 'inbound', coalesce(p_content, ''),
    'free', p_content_type, 'message', p_external_message_id,
    p_external_message_id, 'received', p_received_at
  )
  on conflict (user_id, channel, external_message_id) do nothing
  returning id into v_message_id;

  if v_message_id is not null and p_opt_out then
    insert into public.msg_audit_log (
      user_id, contact_id, action, entity_type, entity_id, details
    )
    values (
      p_user_id, v_contact_id, 'contact.opt_out', 'contact', v_contact_id,
      jsonb_build_object('channel', 'messenger')
    );
  end if;

  return query select v_contact_id, v_message_id, v_message_id is not null;
end;
$$;

revoke all on function public.record_inbound_messenger_message(uuid, text, text, text, text, timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.record_inbound_messenger_message(uuid, text, text, text, text, timestamptz, boolean)
  to service_role;
