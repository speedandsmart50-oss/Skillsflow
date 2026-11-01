drop function if exists public.evaluate_messaging_send(uuid, uuid, uuid, text, text, text, text, text, uuid, boolean, boolean, boolean, integer, integer);
drop table if exists public.msg_send_reservations;
drop table if exists public.msg_approved_templates;
drop index if exists public.msg_messages_id_user_channel_uq;
