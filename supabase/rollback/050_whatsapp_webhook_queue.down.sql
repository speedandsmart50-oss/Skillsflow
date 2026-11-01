drop function if exists public.apply_whatsapp_message_status(uuid, text, text, text, timestamptz);
drop function if exists public.record_inbound_whatsapp_message(uuid, text, text, text, text, text, timestamptz, boolean);
drop table if exists public.msg_webhook_events;
