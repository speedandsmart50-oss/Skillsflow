-- Espaces de travail privés créés par les membres, indépendants des salons SkillFlow.
-- Les membres rejoignent explicitement un espace via son lien d'invitation.

create table public.member_communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  invite_token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  created_at timestamptz not null default now()
);

create table public.member_community_memberships (
  community_id uuid not null references public.member_communities(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  member_role text not null default 'member' check (member_role in ('owner', 'manager', 'member')),
  share_progress boolean not null default false,
  share_avatar boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create table public.member_community_channels (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.member_communities(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  description text not null default '' check (char_length(description) <= 240),
  created_at timestamptz not null default now(),
  unique (community_id, name)
);

create table public.member_community_messages (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.member_communities(id) on delete cascade,
  channel_id uuid not null references public.member_community_channels(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.member_community_tasks (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.member_communities(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 180),
  due_at date,
  created_at timestamptz not null default now()
);

create table public.member_community_task_checks (
  task_id uuid not null references public.member_community_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

create table public.member_direct_threads (
  id uuid primary key default gen_random_uuid(),
  user_one uuid not null references public.profiles(id) on delete cascade,
  user_two uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_one < user_two),
  unique (user_one, user_two)
);

create table public.member_direct_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.member_direct_threads(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index member_community_members_user_idx on public.member_community_memberships(user_id, joined_at desc);
create index member_community_messages_latest_idx on public.member_community_messages(channel_id, created_at desc);
create index member_community_tasks_order_idx on public.member_community_tasks(community_id, due_at, created_at);
create index member_direct_messages_latest_idx on public.member_direct_messages(thread_id, created_at desc);

create function public.member_is_community_member(p_community_id uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$ select auth.uid() is not null and exists (
  select 1 from public.member_community_memberships m
  where m.community_id = p_community_id and m.user_id = auth.uid()
); $$;

create function public.member_manages_community(p_community_id uuid)
returns boolean language sql stable security definer set search_path = public, auth
as $$ select auth.uid() is not null and exists (
  select 1 from public.member_community_memberships m
  where m.community_id = p_community_id and m.user_id = auth.uid() and m.member_role in ('owner', 'manager')
); $$;

create function public.create_member_community(p_name text, p_description text default '')
returns uuid language plpgsql security definer set search_path = public, auth
as $$
declare uid uuid := auth.uid(); new_id uuid; label text;
begin
  if uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if p_name is null or char_length(trim(p_name)) not between 2 and 80 then raise exception 'Le nom doit contenir entre 2 et 80 caractères.' using errcode = '22023'; end if;
  if char_length(trim(coalesce(p_description, ''))) > 500 then raise exception 'La description ne peut pas dépasser 500 caractères.' using errcode = '22023'; end if;
  select coalesce(nullif(trim(display_name), ''), 'Membre ' || left(uid::text, 6)) into label from public.profiles where id = uid;
  if label is null then raise exception 'Profil introuvable.' using errcode = 'P0002'; end if;
  insert into public.member_communities(owner_id, name, description) values (uid, trim(p_name), trim(coalesce(p_description, ''))) returning id into new_id;
  insert into public.member_community_memberships(community_id, user_id, display_name, member_role) values (new_id, uid, label, 'owner');
  insert into public.member_community_channels(community_id, name, description) values (new_id, 'Général', 'Présentez-vous et organisez vos prochaines étapes.');
  return new_id;
end; $$;

create function public.join_member_community(p_invite_token text)
returns uuid language plpgsql security definer set search_path = public, auth
as $$
declare uid uuid := auth.uid(); target_id uuid; label text;
begin
  if uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if p_invite_token is null or p_invite_token !~ '^[a-f0-9]{36}$' then raise exception 'Invitation invalide.' using errcode = '22023'; end if;
  select id into target_id from public.member_communities where invite_token = p_invite_token;
  if target_id is null then raise exception 'Cette invitation est invalide.' using errcode = 'P0002'; end if;
  select coalesce(nullif(trim(display_name), ''), 'Membre ' || left(uid::text, 6)) into label from public.profiles where id = uid;
  if label is null then raise exception 'Profil introuvable.' using errcode = 'P0002'; end if;
  insert into public.member_community_memberships(community_id, user_id, display_name) values (target_id, uid, label)
  on conflict (community_id, user_id) do nothing;
  return target_id;
end; $$;

create function public.open_member_direct_thread(p_peer_user_id uuid)
returns uuid language plpgsql security definer set search_path = public, auth
as $$
declare uid uuid := auth.uid(); first_id uuid; second_id uuid; thread_id uuid;
begin
  if uid is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if p_peer_user_id is null or p_peer_user_id = uid then raise exception 'Choisissez un autre membre.' using errcode = '22023'; end if;
  if not exists (select 1 from public.member_community_memberships mine join public.member_community_memberships peer using (community_id)
    where mine.user_id = uid and peer.user_id = p_peer_user_id) then
    raise exception 'Vous devez partager une communauté pour démarrer une conversation.' using errcode = '42501';
  end if;
  first_id := least(uid, p_peer_user_id); second_id := greatest(uid, p_peer_user_id);
  insert into public.member_direct_threads(user_one, user_two) values (first_id, second_id) on conflict (user_one, user_two) do nothing;
  select id into thread_id from public.member_direct_threads where user_one = first_id and user_two = second_id;
  return thread_id;
end; $$;

create function public.get_member_community_invite_token(p_community_id uuid)
returns text language sql stable security definer set search_path = public, auth
as $$
  select c.invite_token from public.member_communities c
  where c.id = p_community_id and public.member_manages_community(c.id)
  limit 1;
$$;

revoke all on function public.member_is_community_member(uuid), public.member_manages_community(uuid), public.create_member_community(text,text), public.join_member_community(text), public.open_member_direct_thread(uuid), public.get_member_community_invite_token(uuid) from public, anon;
grant execute on function public.member_is_community_member(uuid), public.member_manages_community(uuid), public.create_member_community(text,text), public.join_member_community(text), public.open_member_direct_thread(uuid), public.get_member_community_invite_token(uuid) to authenticated;

alter table public.member_communities enable row level security;
alter table public.member_community_memberships enable row level security;
alter table public.member_community_channels enable row level security;
alter table public.member_community_messages enable row level security;
alter table public.member_community_tasks enable row level security;
alter table public.member_community_task_checks enable row level security;
alter table public.member_direct_threads enable row level security;
alter table public.member_direct_messages enable row level security;

revoke all on public.member_communities, public.member_community_memberships, public.member_community_channels, public.member_community_messages, public.member_community_tasks, public.member_community_task_checks, public.member_direct_threads, public.member_direct_messages from anon, authenticated;
grant select (id, name, description, created_at) on public.member_communities to authenticated;
grant select on public.member_community_memberships, public.member_community_channels, public.member_community_messages, public.member_community_tasks, public.member_community_task_checks, public.member_direct_threads, public.member_direct_messages to authenticated;
grant update (share_progress, share_avatar) on public.member_community_memberships to authenticated;
grant update (name, description) on public.member_communities to authenticated;
grant insert, update, delete on public.member_community_channels to authenticated;
grant insert on public.member_community_messages, public.member_community_tasks, public.member_community_task_checks, public.member_direct_messages to authenticated;
grant delete on public.member_community_task_checks to authenticated;

create policy member_communities_read on public.member_communities for select to authenticated using (public.member_is_community_member(id));
create policy member_communities_update on public.member_communities for update to authenticated using (public.member_manages_community(id)) with check (public.member_manages_community(id));
create policy member_community_members_read on public.member_community_memberships for select to authenticated using (public.member_is_community_member(community_id));
create policy member_community_members_self_preferences on public.member_community_memberships for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy member_community_channels_read on public.member_community_channels for select to authenticated using (public.member_is_community_member(community_id));
create policy member_community_channels_manage on public.member_community_channels for all to authenticated using (public.member_manages_community(community_id)) with check (public.member_manages_community(community_id));
create policy member_community_messages_read on public.member_community_messages for select to authenticated using (public.member_is_community_member(community_id));
create policy member_community_messages_write on public.member_community_messages for insert to authenticated with check (author_id = auth.uid() and public.member_is_community_member(community_id) and exists (select 1 from public.member_community_channels c where c.id = channel_id and c.community_id = member_community_messages.community_id) and exists (select 1 from public.member_community_memberships m where m.community_id = member_community_messages.community_id and m.user_id = auth.uid() and m.display_name = member_community_messages.author_name));
create policy member_community_tasks_read on public.member_community_tasks for select to authenticated using (public.member_is_community_member(community_id));
create policy member_community_tasks_write on public.member_community_tasks for insert to authenticated with check (created_by = auth.uid() and public.member_manages_community(community_id) and (assigned_to is null or exists (select 1 from public.member_community_memberships m where m.community_id = member_community_tasks.community_id and m.user_id = assigned_to)));
create policy member_community_checks_read on public.member_community_task_checks for select to authenticated using (
  user_id = auth.uid() or exists (
    select 1 from public.member_community_tasks t
    join public.member_community_memberships viewer on viewer.community_id = t.community_id and viewer.user_id = auth.uid() and viewer.member_role in ('owner', 'manager')
    join public.member_community_memberships subject on subject.community_id = t.community_id and subject.user_id = member_community_task_checks.user_id and subject.share_progress
    where t.id = task_id
  )
);
create policy member_community_checks_insert on public.member_community_task_checks for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.member_community_tasks t where t.id = task_id and public.member_is_community_member(t.community_id) and (t.assigned_to is null or t.assigned_to = auth.uid())));
create policy member_community_checks_delete on public.member_community_task_checks for delete to authenticated using (user_id = auth.uid());
create policy member_direct_threads_read on public.member_direct_threads for select to authenticated using (auth.uid() in (user_one, user_two));
create policy member_direct_messages_read on public.member_direct_messages for select to authenticated using (exists (select 1 from public.member_direct_threads t where t.id = thread_id and auth.uid() in (t.user_one, t.user_two)));
create policy member_direct_messages_write on public.member_direct_messages for insert to authenticated with check (author_id = auth.uid() and exists (select 1 from public.member_direct_threads t where t.id = thread_id and auth.uid() in (t.user_one, t.user_two)));
