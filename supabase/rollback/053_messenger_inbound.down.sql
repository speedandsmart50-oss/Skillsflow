do $$
begin
  if exists (
    select 1 from public.msg_webhook_events where channel = 'messenger'
  ) then
    raise exception 'Cannot roll back Messenger intake while queued or retained webhook events exist.';
  end if;
end;
$$;

drop function if exists public.record_inbound_messenger_message(uuid, text, text, text, text, timestamptz, boolean);

alter table public.msg_webhook_events
  drop constraint if exists msg_webhook_events_channel_check,
  add constraint msg_webhook_events_channel_check
    check (channel = 'whatsapp');
