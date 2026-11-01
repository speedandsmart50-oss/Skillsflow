create table public.msg_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'messenger', 'instagram')),
  external_contact_id text not null check (char_length(btrim(external_contact_id)) between 1 and 255),
  display_name text check (display_name is null or char_length(display_name) <= 200),
  status text not null default 'new'
    check (status in ('new', 'in_discussion', 'interested', 'converted', 'opted_out')),
  consent_given boolean not null default false,
  consent_at timestamptz,
  consent_source text,
  notes text not null default '' check (char_length(notes) <= 2000),
  last_inbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (consent_given and consent_at is not null and nullif(btrim(consent_source), '') is not null)
    or (not consent_given and consent_at is null and consent_source is null)
  ),
  unique (user_id, channel, external_contact_id),
  unique (id, user_id),
  unique (id, user_id, channel)
);

create table public.msg_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null,
  channel text not null check (channel in ('whatsapp', 'messenger', 'instagram')),
  direction text not null check (direction in ('inbound', 'outbound')),
  content text not null default '' check (char_length(content) <= 30000),
  content_type text not null default 'text' check (content_type in ('text', 'non_text')),
  message_type text not null default 'free' check (message_type in ('free', 'template')),
  template_name text,
  source_event_type text not null default 'message'
    check (source_event_type in ('message', 'comment')),
  source_event_id text check (source_event_id is null or char_length(source_event_id) between 1 and 255),
  reply_to_event_type text,
  reply_to_event_id text check (reply_to_event_id is null or char_length(reply_to_event_id) between 1 and 255),
  external_message_id text check (external_message_id is null or char_length(external_message_id) between 1 and 255),
  status text not null default 'received'
    check (status in ('received', 'draft', 'approved', 'sent', 'delivered', 'read', 'failed')),
  error_code text check (error_code is null or char_length(error_code) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  foreign key (contact_id, user_id, channel)
    references public.msg_contacts(id, user_id, channel) on delete cascade,
  unique (user_id, channel, external_message_id),
  unique (user_id, channel, source_event_type, source_event_id),
  check (
    (message_type = 'free' and template_name is null)
    or (message_type = 'template' and nullif(btrim(template_name), '') is not null)
  ),
  check (direction <> 'inbound' or source_event_id is not null),
  check (source_event_type <> 'comment' or direction = 'inbound'),
  check (
    (reply_to_event_type is null and reply_to_event_id is null)
    or (reply_to_event_type = 'comment' and reply_to_event_id is not null and direction = 'outbound')
  )
);

create table public.msg_followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null,
  message_content text not null check (char_length(message_content) between 1 and 30000),
  message_type text not null default 'free' check (message_type in ('free', 'template')),
  template_name text,
  scheduled_at timestamptz not null,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'processing', 'sent', 'cancelled')),
  cancellation_reason text check (cancellation_reason is null or char_length(cancellation_reason) <= 500),
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  claim_token uuid,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (contact_id, user_id)
    references public.msg_contacts(id, user_id) on delete cascade,
  check (
    (status = 'processing' and claimed_at is not null and claim_expires_at is not null and claim_expires_at > claimed_at and claim_token is not null)
    or (status <> 'processing' and claimed_at is null and claim_expires_at is null and claim_token is null)
  ),
  check (
    (message_type = 'free' and template_name is null)
    or (message_type = 'template' and nullif(btrim(template_name), '') is not null)
  )
);

create table public.msg_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 80),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id uuid,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (contact_id, user_id)
    references public.msg_contacts(id, user_id) on delete cascade
);

create index msg_contacts_user_activity_idx
  on public.msg_contacts (user_id, last_inbound_at desc nulls last);
create index msg_messages_contact_created_idx
  on public.msg_messages (contact_id, created_at desc);
create index msg_messages_user_outbound_created_idx
  on public.msg_messages (user_id, direction, created_at desc);
create unique index msg_messages_one_comment_reply_idx
  on public.msg_messages (user_id, channel, reply_to_event_type, reply_to_event_id)
  where reply_to_event_id is not null;
create index msg_followups_contact_scheduled_idx
  on public.msg_followups (contact_id, scheduled_at);
create index msg_followups_due_idx
  on public.msg_followups (user_id, status, scheduled_at);
create index msg_audit_log_user_created_idx
  on public.msg_audit_log (user_id, created_at desc);

alter table public.msg_contacts enable row level security;
alter table public.msg_messages enable row level security;
alter table public.msg_followups enable row level security;
alter table public.msg_audit_log enable row level security;

create policy msg_contacts_owner_access on public.msg_contacts
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy msg_messages_owner_access on public.msg_messages
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy msg_followups_owner_access on public.msg_followups
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy msg_audit_log_owner_access on public.msg_audit_log
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.msg_contacts, public.msg_messages, public.msg_followups, public.msg_audit_log
  from public, anon, authenticated;
grant all on public.msg_contacts, public.msg_messages, public.msg_followups, public.msg_audit_log
  to service_role;
