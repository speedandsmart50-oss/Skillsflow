drop function if exists public.get_growth_metrics(uuid, timestamptz, boolean);
drop function if exists public.update_growth_reminder_draft(uuid, uuid, uuid, text, boolean);
drop function if exists public.create_growth_reminder_draft(uuid, uuid, uuid, text, text, timestamptz, uuid, boolean);
drop table if exists public.growth_reminders;
