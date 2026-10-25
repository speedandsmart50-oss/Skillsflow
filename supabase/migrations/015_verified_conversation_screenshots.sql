create table if not exists public.agent_conversation_screenshots (
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.agent_conversations(id) on delete cascade,
  storage_path text not null unique,
  verified_at timestamptz not null default now(),
  primary key (conversation_id, storage_path)
);
alter table public.agent_conversation_screenshots enable row level security;
revoke all on public.agent_conversation_screenshots from public, anon, authenticated;
grant all on public.agent_conversation_screenshots to service_role;

-- Conversation rows and screenshot references are created only by the verified
-- server endpoint, which checks each private Storage object before linking it.
drop policy if exists "Members manage their own agent conversations" on public.agent_conversations;
drop policy if exists members_read_own_agent_conversations on public.agent_conversations;
drop policy if exists members_delete_own_agent_conversations on public.agent_conversations;
create policy members_read_own_agent_conversations
  on public.agent_conversations for select to authenticated
  using (auth.uid() = user_id);
create policy members_delete_own_agent_conversations
  on public.agent_conversations for delete to authenticated
  using (auth.uid() = user_id);
revoke all on public.agent_conversations from anon, authenticated;
grant select, delete on public.agent_conversations to authenticated;
grant all on public.agent_conversations to service_role;
