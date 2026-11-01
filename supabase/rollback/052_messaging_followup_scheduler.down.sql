drop function if exists public.complete_whatsapp_followup(uuid, uuid, text, text, uuid);
drop function if exists public.claim_due_whatsapp_followups(integer, boolean);
drop function if exists public.approve_whatsapp_followup_draft(uuid, uuid, uuid, boolean);
drop function if exists public.fail_whatsapp_followup_draft(uuid, uuid, uuid, uuid, boolean);
drop function if exists public.cancel_whatsapp_followup(uuid, uuid, uuid, boolean);
drop function if exists public.approve_whatsapp_followup(uuid, uuid, uuid, boolean);
drop function if exists public.create_whatsapp_followup_draft(uuid, uuid, uuid, timestamptz, text, text, text, text, uuid, boolean);
drop index if exists public.msg_followups_due_at_idx;

alter table public.msg_followups
  drop constraint if exists msg_followups_result_message_id_fkey,
  drop constraint if exists msg_followups_idempotency_key_uq,
  drop constraint if exists msg_followups_result_message_check,
  drop constraint if exists msg_followups_approval_state_check;

update public.msg_followups
set status = case
      when status in ('scheduled', 'sent', 'cancelled') then status
      else 'cancelled'
    end,
    message_content = case
      when message_content = '' then coalesce(nullif(template_name, ''), 'template')
      else message_content
    end,
    approved_at = null,
    approved_by = null,
    result_message_id = null,
    claim_token = null,
    claimed_at = null,
    claim_expires_at = null;

alter table public.msg_followups
  drop constraint if exists msg_followups_template_name_check,
  drop constraint if exists msg_followups_message_content_check,
  drop constraint if exists msg_followups_status_check,
  drop column if exists result_message_id,
  drop column if exists idempotency_key,
  drop column if exists template_language,
  drop column if exists approved_by,
  drop column if exists approved_at,
  drop column if exists jitter_seconds,
  drop column if exists due_at;

alter table public.msg_followups
  add constraint msg_followups_status_check
    check (status in ('scheduled', 'processing', 'sent', 'cancelled')),
  add constraint msg_followups_message_content_check
    check (char_length(message_content) between 1 and 30000),
  add constraint msg_followups_template_name_check
    check (
      (message_type = 'free' and template_name is null)
      or (message_type = 'template' and nullif(btrim(template_name), '') is not null)
    );

alter table public.msg_messages
  drop constraint if exists msg_messages_id_user_uq;
