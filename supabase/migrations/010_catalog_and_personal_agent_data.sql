-- Reconcile the production catalog with the columns consumed by the application.
alter table public.products
  add column if not exists domain text not null default 'Général',
  add column if not exists catalog_status text not null default 'en_preparation',
  add column if not exists price_eur numeric(10, 2),
  add column if not exists price_xof bigint,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.products
set catalog_status = case when status = 'published' then 'disponible' else 'en_preparation' end,
    price_eur = coalesce(price_eur, price),
    price_xof = coalesce(price_xof, round(price * 655.957)::bigint)
where price_eur is null or price_xof is null;

alter table public.products alter column price_eur set not null;
alter table public.products alter column price_xof set not null;
alter table public.products drop constraint if exists products_catalog_status_check;
alter table public.products add constraint products_catalog_status_check
  check (catalog_status in ('a_venir', 'en_preparation', 'disponible'));

create table if not exists public.skill_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  version text not null,
  release_notes text,
  claude_file_path text,
  chatgpt_file_path text,
  archive_path text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique (product_id, version)
);
alter table public.skill_versions enable row level security;
drop policy if exists "Public can read published skill versions" on public.skill_versions;
create policy "Public can read published skill versions" on public.skill_versions for select
  using (status = 'published' and exists (
    select 1 from public.products where products.id = skill_versions.product_id
      and products.status = 'published' and products.archived_at is null
  ));
revoke all on public.skill_versions from anon, authenticated;
grant select (id, product_id, version, release_notes, status, published_at, created_at)
  on public.skill_versions to anon, authenticated;
grant all on public.skill_versions to service_role;

-- Keep the starter skill from the landing page purchasable on projects that missed migration 003.
insert into public.products (
  slug, name, description, status, price, version, zip_path,
  domain, catalog_status, price_eur, price_xof
)
values (
  'prospection-ethique',
  'Prospection éthique avec l’IA',
  'Pack multiplateforme de prospection éthique pour Claude et ChatGPT.',
  'published', 39, '1.0.0', 'prospection-ethique/prospection-ethique-v1.0.0.zip',
  'Vente & marketing', 'disponible', 39, 25582
)
on conflict (slug) do nothing;

insert into public.product_versions (
  product_id, version, release_notes, zip_path, status, published_at
)
select id, '1.0.0',
  'Pack multiplateforme avec skill Claude, instructions ChatGPT et guide d’installation.',
  'prospection-ethique/prospection-ethique-v1.0.0.zip', 'published', now()
from public.products where slug = 'prospection-ethique'
on conflict (product_id, version) do nothing;

insert into public.skill_versions (
  product_id, version, release_notes, archive_path, status, published_at
)
select product_id, version, release_notes, zip_path, status, published_at
from public.product_versions
where product_id = (select id from public.products where slug = 'prospection-ethique')
  and version = '1.0.0'
on conflict (product_id, version) do nothing;

-- Private conversation examples belong to one signed-in member and are not model-trained automatically.
create table if not exists public.agent_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  conversation_text text not null check (char_length(conversation_text) between 20 and 30000),
  screenshot_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists agent_conversations_user_created_idx
  on public.agent_conversations (user_id, created_at desc);
alter table public.agent_conversations enable row level security;
drop policy if exists "Members manage their own agent conversations" on public.agent_conversations;
create policy "Members manage their own agent conversations" on public.agent_conversations
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.agent_conversations from anon, authenticated;
grant select, insert, delete on public.agent_conversations to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agent-conversations', 'agent-conversations', false, 7340032,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members manage their own agent conversation screenshots" on storage.objects;
create policy "Members manage their own agent conversation screenshots" on storage.objects
  for all to authenticated using (
    bucket_id = 'agent-conversations' and (storage.foldername(name))[1] = auth.uid()::text
  ) with check (
    bucket_id = 'agent-conversations' and (storage.foldername(name))[1] = auth.uid()::text
  );
