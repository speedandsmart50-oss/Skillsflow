create table if not exists public.community_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  kind text not null check (kind in ('reply', 'mention', 'dm')),
  actor_name text not null,
  channel_name text not null,
  excerpt text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, message_id, kind)
);

create index if not exists community_notifications_unread_idx
  on public.community_notifications (user_id, created_at desc)
  where read_at is null;

alter table public.community_notifications enable row level security;
revoke all on public.community_notifications from anon, authenticated;
grant select on public.community_notifications to authenticated;
grant update (read_at) on public.community_notifications to authenticated;

drop policy if exists community_notifications_read_self on public.community_notifications;
create policy community_notifications_read_self on public.community_notifications
  for select to authenticated
  using (user_id = auth.uid() and public.community_can_access_channel(channel_id));

drop policy if exists community_notifications_mark_self on public.community_notifications;
create policy community_notifications_mark_self on public.community_notifications
  for update to authenticated
  using (user_id = auth.uid() and public.community_can_access_channel(channel_id))
  with check (user_id = auth.uid() and public.community_can_access_channel(channel_id));

create or replace function public.notify_community_reply()
returns trigger
language plpgsql security definer set search_path = public, auth
as $$
declare
  recipient_id uuid;
  actor_label text;
  channel_label text;
begin
  if new.parent_id is null then return new; end if;

  select author_id into recipient_id
  from public.messages
  where id = new.parent_id and channel_id = new.channel_id and deleted_at is null;

  if recipient_id is null or recipient_id = new.author_id then return new; end if;

  select display_name into actor_label
  from public.community_members where user_id = new.author_id;
  select name into channel_label
  from public.channels where id = new.channel_id;

  insert into public.community_notifications
    (user_id, actor_id, channel_id, message_id, kind, actor_name, channel_name, excerpt)
  values
    (recipient_id, new.author_id, new.channel_id, new.id, 'reply',
     coalesce(actor_label, 'Un membre'), coalesce(channel_label, 'un salon'), left(new.content, 160))
  on conflict (user_id, message_id, kind) do nothing;

  return new;
end;
$$;

drop trigger if exists community_reply_notification_after_insert on public.messages;
create trigger community_reply_notification_after_insert
  after insert on public.messages
  for each row execute function public.notify_community_reply();

revoke all on function public.notify_community_reply() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_notifications'
     ) then
    alter publication supabase_realtime add table public.community_notifications;
  end if;
end $$;
