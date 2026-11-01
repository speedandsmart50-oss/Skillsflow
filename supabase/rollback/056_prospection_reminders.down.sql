drop table if exists public.prospection_reminders;
alter table public.prospection_prospects
  drop constraint if exists prospection_prospects_id_user_id_key;
