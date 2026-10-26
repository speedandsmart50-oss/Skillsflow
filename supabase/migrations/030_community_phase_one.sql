-- Community foundation: private channels, chat, reactions, pins, reports and rules acceptance.
-- Access stays scoped to authenticated members; all tables have RLS enabled.

create table if not exists public.community_rules (
  version text primary key,
  body text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.community_rules (version, body, is_active)
values (
  'community-v1',
  'Respectez les membres et leur refus. Pas de promesses de revenus, de pression, de spam ni de partage de données personnelles sans accord. Les échanges doivent rester utiles, honnêtes et conformes aux règles applicables.',
  true
)
on conflict (version) do update set body = excluded.body, is_active = true;
update public.community_rules set is_active = false where version <> 'community-v1';

create table if not exists public.community_memberships (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tier integer not null default 0 check (tier >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.community_staff (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  staff_role text not null check (staff_role in ('coach', 'moderator')),
  created_at timestamptz not null default now()
);

create table if not exists public.community_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 1 and 80),
  description text not null default '',
  required_tier integer not null default 0 check (required_tier >= 0),
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null references public.community_members(user_id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  parent_id uuid references public.messages(id) on delete set null,
  pinned_at timestamptz,
  pinned_by uuid references public.profiles(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((pinned_at is null) = (pinned_by is null)),
  unique (id, channel_id)
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (emoji in ('👍', '❤️', '💪', '🎯', '🙏')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji),
  foreign key (message_id, channel_id) references public.messages(id, channel_id) on delete cascade
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (message_id, reporter_id)
);

create table if not exists public.channel_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, channel_id)
);

create index if not exists channels_active_position_idx on public.channels (position, name) where is_active;
create index if not exists messages_channel_created_idx on public.messages (channel_id, created_at desc) where deleted_at is null;
create index if not exists messages_parent_idx on public.messages (parent_id) where parent_id is not null;
create index if not exists reactions_message_idx on public.reactions (message_id);
create index if not exists reports_status_created_idx on public.reports (status, created_at desc);
create index if not exists channel_reads_channel_idx on public.channel_reads (channel_id, last_read_at);

alter table public.profiles add column if not exists community_rules_version text;
alter table public.profiles add column if not exists community_rules_accepted_at timestamptz;

create or replace function public.community_is_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) or exists (
    select 1 from public.community_staff s where s.user_id = auth.uid()
  );
$$;

create or replace function public.community_can_access_channel(p_channel_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.community_is_staff() or exists (
    select 1
    from public.channels c
    join public.community_memberships m on m.user_id = auth.uid()
    join public.profiles p on p.id = m.user_id
    where c.id = p_channel_id
      and c.is_active
      and m.tier >= c.required_tier
      and exists (
        select 1 from public.community_rules r
        where r.is_active and p.community_rules_version = r.version
      )
  );
$$;

create or replace function public.community_list_channels()
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  required_tier integer,
  position integer,
  accessible boolean
)
language sql stable security definer set search_path = public
as $$
  select c.id, c.slug, c.name, c.description, c.required_tier, c.position,
    public.community_is_staff() or (
      m.user_id is not null
      and m.tier >= c.required_tier
      and exists (select 1 from public.community_rules r where r.is_active and p.community_rules_version = r.version)
    ) as accessible
  from public.channels c
  join public.profiles p on p.id = auth.uid()
  left join public.community_memberships m on m.user_id = p.id
  where c.is_active
  order by c.position, c.name;
$$;

create or replace function public.accept_community_rules(p_version text, p_display_name text)
returns void
language plpgsql security definer set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  clean_name text := nullif(trim(p_display_name), '');
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if clean_name is null or char_length(clean_name) not between 1 and 60 then raise exception 'Nom invalide'; end if;
  if not exists (select 1 from public.community_rules where version = p_version and is_active) then
    raise exception 'Version des règles inactive';
  end if;
  update public.profiles
    set community_rules_version = p_version, community_rules_accepted_at = now()
    where id = current_user_id;
  insert into public.community_memberships (user_id, tier)
    values (current_user_id, 0) on conflict (user_id) do nothing;
  insert into public.community_members (user_id, display_name)
    values (current_user_id, clean_name)
    on conflict (user_id) do update set display_name = excluded.display_name, updated_at = now();
end;
$$;

revoke all on function public.community_is_staff() from public, anon;
revoke all on function public.community_can_access_channel(uuid) from public, anon;
revoke all on function public.community_list_channels() from public, anon;
revoke all on function public.accept_community_rules(text, text) from public, anon;
grant execute on function public.community_is_staff() to authenticated;
grant execute on function public.community_can_access_channel(uuid) to authenticated;
grant execute on function public.community_list_channels() to authenticated;
grant execute on function public.accept_community_rules(text, text) to authenticated;

create or replace function public.pin_community_message(p_message_id uuid, p_pin boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null or not public.community_is_staff() then raise exception 'Accès réservé à l’équipe.'; end if;
  update public.messages
    set pinned_at = case when p_pin then now() else null end,
        pinned_by = case when p_pin then auth.uid() else null end,
        updated_at = now()
    where id = p_message_id and public.community_can_access_channel(channel_id);
  if not found then raise exception 'Message introuvable.'; end if;
end;
$$;
revoke all on function public.pin_community_message(uuid, boolean) from public, anon;
grant execute on function public.pin_community_message(uuid, boolean) to authenticated;

alter table public.community_rules enable row level security;
alter table public.community_memberships enable row level security;
alter table public.community_staff enable row level security;
alter table public.community_members enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;
alter table public.reactions enable row level security;
alter table public.reports enable row level security;
alter table public.channel_reads enable row level security;

revoke all on public.community_rules, public.community_memberships, public.community_staff,
  public.community_members, public.channels, public.messages, public.reactions,
  public.reports, public.channel_reads from anon, authenticated;
grant select on public.community_rules to authenticated;
grant select on public.community_memberships to authenticated;
grant select on public.community_staff to authenticated;
grant select, insert (user_id, display_name), update (display_name) on public.community_members to authenticated;
grant select on public.channels to authenticated;
grant select, insert (channel_id, author_id, content, parent_id) on public.messages to authenticated;
grant update (content, deleted_at) on public.messages to authenticated;
grant select, insert (message_id, channel_id, user_id, emoji), delete on public.reactions to authenticated;
grant select, insert (message_id, reporter_id, reason) on public.reports to authenticated;
grant select, insert, update on public.channel_reads to authenticated;

drop policy if exists community_rules_read_active on public.community_rules;
create policy community_rules_read_active on public.community_rules for select to authenticated using (is_active);
drop policy if exists community_memberships_read_self_or_staff on public.community_memberships;
create policy community_memberships_read_self_or_staff on public.community_memberships for select to authenticated using (user_id = auth.uid() or public.community_is_staff());
drop policy if exists community_staff_read_self_or_admin on public.community_staff;
create policy community_staff_read_self_or_admin on public.community_staff for select to authenticated using (user_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists community_members_read_accepted on public.community_members;
create policy community_members_read_accepted on public.community_members for select to authenticated using (
  exists (select 1 from public.profiles p join public.community_rules r on r.version = p.community_rules_version and r.is_active where p.id = auth.uid())
);
drop policy if exists community_members_insert_self on public.community_members;
create policy community_members_insert_self on public.community_members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists community_members_update_self on public.community_members;
create policy community_members_update_self on public.community_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists channels_read_accessible on public.channels;
create policy channels_read_accessible on public.channels for select to authenticated using (public.community_can_access_channel(id));
drop policy if exists messages_read_accessible on public.messages;
create policy messages_read_accessible on public.messages for select to authenticated using (public.community_can_access_channel(channel_id) and (deleted_at is null or author_id = auth.uid() or public.community_is_staff()));
drop policy if exists messages_insert_accessible on public.messages;
create policy messages_insert_accessible on public.messages for insert to authenticated with check (author_id = auth.uid() and deleted_at is null and pinned_at is null and public.community_can_access_channel(channel_id));
drop policy if exists messages_update_author_or_staff on public.messages;
create policy messages_update_author_or_staff on public.messages for update to authenticated using (
  public.community_can_access_channel(channel_id) and ((author_id = auth.uid() and created_at > now() - interval '15 minutes') or public.community_is_staff())
) with check (public.community_can_access_channel(channel_id) and (author_id = auth.uid() or public.community_is_staff()));
drop policy if exists reactions_read_accessible on public.reactions;
create policy reactions_read_accessible on public.reactions for select to authenticated using (
  public.community_can_access_channel(channel_id)
);
drop policy if exists reactions_insert_self on public.reactions;
create policy reactions_insert_self on public.reactions for insert to authenticated with check (
  user_id = auth.uid() and public.community_can_access_channel(channel_id)
  and exists (select 1 from public.messages m where m.id = reactions.message_id and m.channel_id = reactions.channel_id and m.deleted_at is null)
);
drop policy if exists reactions_delete_self on public.reactions;
create policy reactions_delete_self on public.reactions for delete to authenticated using (
  user_id = auth.uid() and public.community_can_access_channel(channel_id)
);
drop policy if exists reports_insert_self on public.reports;
create policy reports_insert_self on public.reports for insert to authenticated with check (
  reporter_id = auth.uid() and exists (select 1 from public.messages m where m.id = message_id and public.community_can_access_channel(m.channel_id))
);
drop policy if exists reports_staff_read on public.reports;
create policy reports_staff_read on public.reports for select to authenticated using (public.community_is_staff());
drop policy if exists channel_reads_self on public.channel_reads;
create policy channel_reads_self on public.channel_reads for all to authenticated using (
  user_id = auth.uid() and public.community_can_access_channel(channel_id)
) with check (user_id = auth.uid() and public.community_can_access_channel(channel_id));

create or replace function public.guard_community_message()
returns trigger
language plpgsql security invoker set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  if tg_op = 'INSERT' and new.author_id <> auth.uid() then raise exception 'Auteur invalide'; end if;
  if tg_op = 'UPDATE' and new.author_id <> auth.uid() and not public.community_is_staff() then raise exception 'Auteur invalide'; end if;
  if tg_op = 'INSERT' and new.parent_id is not null and not exists (
    select 1 from public.messages parent
    where parent.id = new.parent_id and parent.channel_id = new.channel_id and parent.deleted_at is null
  ) then raise exception 'La réponse doit viser un message actif de ce salon.'; end if;
  if new.content !~* '\m(gains? garantis?|revenu passif garanti|sans risque|devenir riche|derni[eè]re chance|garantis? des gains?)\M' then
    null;
  else
    raise exception 'Ce message contient une promesse ou une pression commerciale interdite. Reformulez-le sans garantie ni urgence.';
  end if;
  if tg_op = 'INSERT' and exists (
    select 1 from public.messages m
    where m.author_id = auth.uid() and m.channel_id = new.channel_id
      and m.created_at > now() - interval '2 seconds'
  ) then raise exception 'Attendez quelques secondes avant d’envoyer un autre message.'; end if;
  if tg_op = 'INSERT' and exists (
    select 1 from public.messages m
    where m.author_id = auth.uid() and m.channel_id = new.channel_id
      and lower(trim(m.content)) = lower(trim(new.content))
      and m.created_at > now() - interval '5 minutes'
  ) then raise exception 'Ce message a déjà été envoyé récemment.'; end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_community_message_before_insert on public.messages;
create trigger guard_community_message_before_insert before insert on public.messages
for each row execute function public.guard_community_message();
drop trigger if exists guard_community_message_before_update on public.messages;
create trigger guard_community_message_before_update before update on public.messages
for each row execute function public.guard_community_message();

insert into public.channels (slug, name, description, position) values
  ('bienvenue', 'Bienvenue', 'Présentez-vous et découvrez les règles de la communauté.', 10),
  ('prospection', 'Prospection', 'Échangez sur les prises de contact et les conversations respectueuses.', 20),
  ('confiance-et-rejet', 'Confiance et rejet', 'Partagez vos questions sur la confiance, les refus et la régularité.', 30),
  ('organisation', 'Organisation', 'Parlez routines, objectifs d’activité et suivi.', 40),
  ('questions-au-coach', 'Questions au coach', 'Posez vos questions à l’équipe d’accompagnement.', 50)
on conflict (slug) do nothing;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
      alter publication supabase_realtime add table public.messages;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reactions') then
      alter publication supabase_realtime add table public.reactions;
    end if;
  end if;
end $$;
