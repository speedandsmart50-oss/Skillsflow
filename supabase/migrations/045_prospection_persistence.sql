create table if not exists public.prospection_prospects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  company text not null default '' check (char_length(company) <= 100),
  channel text not null check (char_length(channel) between 1 and 40),
  channel_url text not null default '' check (char_length(channel_url) <= 500),
  note text not null default '' check (char_length(note) <= 180),
  stage text not null default 'new' check (stage in ('new', 'contacted', 'presentation', 'follow-up', 'won', 'lost')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prospection_prospects_user_updated_idx
  on public.prospection_prospects(user_id, updated_at desc);

alter table public.prospection_prospects enable row level security;
create policy "Members read own prospects" on public.prospection_prospects
  for select to authenticated using (auth.uid() = user_id);
create policy "Members insert own prospects" on public.prospection_prospects
  for insert to authenticated with check (auth.uid() = user_id and public.has_active_member_subscription(auth.uid()));
create policy "Members update own prospects" on public.prospection_prospects
  for update to authenticated using (auth.uid() = user_id and public.has_active_member_subscription(auth.uid()))
  with check (auth.uid() = user_id and public.has_active_member_subscription(auth.uid()));
create policy "Members delete own prospects" on public.prospection_prospects
  for delete to authenticated using (auth.uid() = user_id and public.has_active_member_subscription(auth.uid()));

revoke all on public.prospection_prospects from anon, authenticated;
grant select, insert, update, delete on public.prospection_prospects to authenticated;
grant all on public.prospection_prospects to service_role;

