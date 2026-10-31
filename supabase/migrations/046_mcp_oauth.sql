create table if not exists public.oauth_clients (
  client_id text primary key,
  client_secret_hash text,
  client_name text not null,
  redirect_uris jsonb not null,
  grant_types jsonb not null default '["authorization_code","refresh_token"]'::jsonb,
  response_types jsonb not null default '["code"]'::jsonb,
  token_endpoint_auth_method text not null default 'none' check (token_endpoint_auth_method in ('none', 'client_secret_post')),
  created_at timestamptz not null default now()
);

create table if not exists public.oauth_authorization_codes (
  code_hash text primary key,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  resource text not null,
  scope text not null default 'mcp:read',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oauth_authorization_codes_expiry_idx on public.oauth_authorization_codes (expires_at);

create table if not exists public.oauth_access_tokens (
  token_hash text primary key,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  resource text not null,
  scope text not null default 'mcp:read',
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oauth_access_tokens_user_idx on public.oauth_access_tokens (user_id, created_at desc);
create index if not exists oauth_access_tokens_expiry_idx on public.oauth_access_tokens (expires_at);

create table if not exists public.oauth_refresh_tokens (
  token_hash text primary key,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  resource text not null,
  scope text not null default 'mcp:read',
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oauth_refresh_tokens_user_idx on public.oauth_refresh_tokens (user_id, created_at desc);

alter table public.oauth_clients enable row level security;
alter table public.oauth_authorization_codes enable row level security;
alter table public.oauth_access_tokens enable row level security;
alter table public.oauth_refresh_tokens enable row level security;

revoke all on public.oauth_clients, public.oauth_authorization_codes, public.oauth_access_tokens, public.oauth_refresh_tokens from anon, authenticated;
grant all on public.oauth_clients, public.oauth_authorization_codes, public.oauth_access_tokens, public.oauth_refresh_tokens to service_role;
