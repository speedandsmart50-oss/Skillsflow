create table if not exists public.community_weekly_goals (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  title text not null check (char_length(title) between 3 and 140),
  description text not null default '' check (char_length(description) <= 500),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_weekly_goal_tasks (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.community_weekly_goals(id) on delete cascade,
  label text not null check (char_length(label) between 2 and 140),
  position integer not null check (position between 1 and 12),
  unique (goal_id, position)
);

create table if not exists public.community_weekly_goal_checks (
  task_id uuid not null references public.community_weekly_goal_tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_at timestamptz not null default now(),
  primary key (task_id, user_id)
);

alter table public.community_weekly_goals enable row level security;
alter table public.community_weekly_goal_tasks enable row level security;
alter table public.community_weekly_goal_checks enable row level security;

revoke all on public.community_weekly_goals, public.community_weekly_goal_tasks,
  public.community_weekly_goal_checks from anon, authenticated;
grant select on public.community_weekly_goals, public.community_weekly_goal_tasks,
  public.community_weekly_goal_checks to authenticated;
grant insert (task_id, user_id), delete on public.community_weekly_goal_checks to authenticated;

drop policy if exists community_weekly_goals_read on public.community_weekly_goals;
create policy community_weekly_goals_read on public.community_weekly_goals
  for select to authenticated using (
    week_start = date_trunc('week', current_date)::date
    and
    exists (select 1 from public.channels c where c.slug = 'organisation' and public.community_can_access_channel(c.id))
  );
drop policy if exists community_weekly_goals_staff_write on public.community_weekly_goals;
create policy community_weekly_goals_staff_write on public.community_weekly_goals
  for all to authenticated using (public.community_is_staff()) with check (public.community_is_staff());

drop policy if exists community_weekly_goal_tasks_read on public.community_weekly_goal_tasks;
create policy community_weekly_goal_tasks_read on public.community_weekly_goal_tasks
  for select to authenticated using (
    exists (select 1 from public.community_weekly_goals g where g.id = goal_id and g.week_start = date_trunc('week', current_date)::date)
  );
drop policy if exists community_weekly_goal_tasks_staff_write on public.community_weekly_goal_tasks;
create policy community_weekly_goal_tasks_staff_write on public.community_weekly_goal_tasks
  for all to authenticated using (public.community_is_staff()) with check (public.community_is_staff());

drop policy if exists community_weekly_goal_checks_read on public.community_weekly_goal_checks;
create policy community_weekly_goal_checks_read on public.community_weekly_goal_checks
  for select to authenticated using (
    exists (
      select 1 from public.community_weekly_goal_tasks t
      join public.community_weekly_goals g on g.id = t.goal_id
      where t.id = task_id and g.week_start = date_trunc('week', current_date)::date
    ) and exists (
      select 1 from public.channels c where c.slug = 'organisation' and public.community_can_access_channel(c.id)
    )
  );
drop policy if exists community_weekly_goal_checks_insert_self on public.community_weekly_goal_checks;
create policy community_weekly_goal_checks_insert_self on public.community_weekly_goal_checks
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_weekly_goal_tasks t
      join public.community_weekly_goals g on g.id = t.goal_id
      where t.id = task_id and g.week_start = date_trunc('week', current_date)::date
    )
    and exists (
      select 1 from public.channels c where c.slug = 'organisation' and public.community_can_access_channel(c.id)
    )
  );
drop policy if exists community_weekly_goal_checks_delete_self on public.community_weekly_goal_checks;
create policy community_weekly_goal_checks_delete_self on public.community_weekly_goal_checks
  for delete to authenticated using (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_weekly_goal_tasks t
      join public.community_weekly_goals g on g.id = t.goal_id
      where t.id = task_id and g.week_start = date_trunc('week', current_date)::date
    )
    and exists (
      select 1 from public.channels c where c.slug = 'organisation' and public.community_can_access_channel(c.id)
    )
  );

create or replace function public.community_weekly_goal_roster()
returns table (user_id uuid, display_name text)
language sql stable security definer set search_path = public
as $$
  select cm.user_id, cm.display_name
  from public.community_members cm
  join public.community_memberships m on m.user_id = cm.user_id
  join public.profiles p on p.id = cm.user_id
  join public.channels c on c.slug = 'organisation' and c.is_active and m.tier >= c.required_tier
  where public.community_can_access_channel(c.id)
    and exists (
      select 1 from public.community_rules r
      where r.is_active and p.community_rules_version = r.version
    )
  order by cm.display_name;
$$;
revoke all on function public.community_weekly_goal_roster() from public, anon;
grant execute on function public.community_weekly_goal_roster() to authenticated;

create or replace function public.set_community_weekly_goal(p_title text, p_description text, p_tasks text[])
returns uuid
language plpgsql security definer set search_path = public, auth
as $$
declare
  current_goal_id uuid;
  item text;
  item_position integer := 0;
  existing_task_id uuid;
begin
  if auth.uid() is null or not public.community_is_staff() then
    raise exception 'Accès réservé à l’équipe.' using errcode = '42501';
  end if;
  if p_title is null or char_length(trim(p_title)) not between 3 and 140 then
    raise exception 'Le titre doit contenir entre 3 et 140 caractères.' using errcode = '22023';
  end if;
  if coalesce(char_length(trim(p_description)), 0) > 500 then
    raise exception 'La description ne peut pas dépasser 500 caractères.' using errcode = '22023';
  end if;
  if p_tasks is null or cardinality(p_tasks) not between 1 and 12 then
    raise exception 'Ajoutez entre 1 et 12 actions.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_tasks) task where char_length(trim(task)) not between 2 and 140) then
    raise exception 'Chaque action doit contenir entre 2 et 140 caractères.' using errcode = '22023';
  end if;

  insert into public.community_weekly_goals (week_start, title, description, created_by)
  values (date_trunc('week', current_date)::date, trim(p_title), trim(coalesce(p_description, '')), auth.uid())
  on conflict (week_start) do update
    set title = excluded.title, description = excluded.description, updated_at = now()
  returning id into current_goal_id;

  foreach item in array p_tasks loop
    item_position := item_position + 1;
    select id into existing_task_id from public.community_weekly_goal_tasks
      where goal_id = current_goal_id and position = item_position;
    if existing_task_id is null then
      insert into public.community_weekly_goal_tasks (goal_id, label, position)
      values (current_goal_id, trim(item), item_position);
    else
      update public.community_weekly_goal_tasks set label = trim(item) where id = existing_task_id;
    end if;
    existing_task_id := null;
  end loop;

  delete from public.community_weekly_goal_tasks
    where goal_id = current_goal_id and position > item_position;
  return current_goal_id;
end;
$$;
revoke all on function public.set_community_weekly_goal(text, text, text[]) from public, anon;
grant execute on function public.set_community_weekly_goal(text, text, text[]) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'community_weekly_goal_checks') then
    alter publication supabase_realtime add table public.community_weekly_goal_checks;
  end if;
end $$;
