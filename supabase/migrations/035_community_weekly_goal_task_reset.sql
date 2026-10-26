create or replace function public.set_community_weekly_goal(p_title text, p_description text, p_tasks text[])
returns uuid
language plpgsql security definer set search_path = public, auth
as $$
declare
  current_goal_id uuid;
  item text;
  item_position integer := 0;
  existing_task_id uuid;
  existing_task_label text;
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
    select id, label into existing_task_id, existing_task_label from public.community_weekly_goal_tasks
      where goal_id = current_goal_id and position = item_position;
    if existing_task_id is null then
      insert into public.community_weekly_goal_tasks (goal_id, label, position)
      values (current_goal_id, trim(item), item_position);
    else
      if existing_task_label is distinct from trim(item) then
        delete from public.community_weekly_goal_checks where task_id = existing_task_id;
      end if;
      update public.community_weekly_goal_tasks set label = trim(item) where id = existing_task_id;
    end if;
    existing_task_id := null;
    existing_task_label := null;
  end loop;

  delete from public.community_weekly_goal_tasks
    where goal_id = current_goal_id and position > item_position;
  return current_goal_id;
end;
$$;
