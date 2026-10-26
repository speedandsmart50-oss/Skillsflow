-- Fast full-text search within channel messages; RLS still scopes results to accessible channels.
alter table public.messages
  add column if not exists search_vector tsvector
  generated always as (to_tsvector('simple', coalesce(content, ''))) stored;

create index if not exists messages_search_vector_idx
  on public.messages using gin (search_vector);
