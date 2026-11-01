alter table public.prospection_prospects
  add constraint prospection_prospects_id_user_id_key unique (id, user_id);

create table public.prospection_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prospect_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 140),
  details text not null default '' check (char_length(details) <= 1000),
  due_at timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft', 'completed', 'cancelled')),
  idempotency_key uuid not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (prospect_id, user_id)
    references public.prospection_prospects(id, user_id) on delete cascade,
  unique (user_id, idempotency_key),
  check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create index prospection_reminders_user_due_idx
  on public.prospection_reminders (user_id, due_at)
  where status = 'draft';

alter table public.prospection_reminders enable row level security;
create policy "Members read own prospect reminders" on public.prospection_reminders
  for select to authenticated using (auth.uid() = user_id);
create policy "Members create own prospect reminders" on public.prospection_reminders
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.has_active_member_subscription(auth.uid())
  );
create policy "Members update own prospect reminders" on public.prospection_reminders
  for update to authenticated
  using (
    auth.uid() = user_id
    and public.has_active_member_subscription(auth.uid())
  )
  with check (
    auth.uid() = user_id
    and public.has_active_member_subscription(auth.uid())
  );
create policy "Members delete own prospect reminders" on public.prospection_reminders
  for delete to authenticated
  using (
    auth.uid() = user_id
    and public.has_active_member_subscription(auth.uid())
  );

revoke all on public.prospection_reminders from public, anon, authenticated;
grant select, insert, update, delete on public.prospection_reminders to authenticated;
grant all on public.prospection_reminders to service_role;
