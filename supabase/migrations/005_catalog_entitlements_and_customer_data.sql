comment on table public.profiles is
  'Application user records linked to Supabase Auth users.';

revoke update, delete, truncate, references, trigger
  on public.audit_log
  from service_role;
grant select, insert on public.audit_log to service_role;

create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  );
$$;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated, service_role;

create policy "Admins can read all profiles" on public.profiles for select
  using (public.is_current_user_admin());

create policy "Admins can read all downloads" on public.downloads for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

alter table public.products
  add column if not exists domain text not null default 'Général',
  add column if not exists catalog_status text not null default 'en_preparation',
  add column if not exists price_eur numeric(10, 2),
  add column if not exists price_xof bigint,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.products
set
  catalog_status = case
    when status = 'published' then 'disponible'
    else 'en_preparation'
  end,
  price_eur = price,
  price_xof = round(price * 655.957)::bigint
where price_eur is null or price_xof is null;

alter table public.products
  alter column price_eur set not null,
  alter column price_xof set not null;

alter table public.products
  add constraint products_catalog_status_check
  check (catalog_status in ('a_venir', 'en_preparation', 'disponible'));

drop policy if exists "Public product read access" on public.products;
create policy "Public product read access" on public.products for select
  using (status = 'published' and archived_at is null);

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

insert into public.skill_versions (
  product_id,
  version,
  release_notes,
  archive_path,
  status,
  published_at
)
select
  product_id,
  version,
  release_notes,
  zip_path,
  status,
  published_at
from public.product_versions
where product_id is not null
on conflict (product_id, version) do nothing;

alter table public.skill_versions enable row level security;

create policy "Public can read published skill versions" on public.skill_versions for select
  using (
    status = 'published'
    and exists (
      select 1
      from public.products
      where products.id = skill_versions.product_id
        and products.status = 'published'
        and products.archived_at is null
    )
  );
create policy "Admins manage skill versions" on public.skill_versions for all
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

revoke all on public.skill_versions from anon, authenticated;
grant select (
  id,
  product_id,
  version,
  release_notes,
  status,
  published_at,
  created_at
) on public.skill_versions to anon, authenticated;
grant all on public.skill_versions to service_role;

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id),
  order_id uuid references public.orders(id) on delete set null,
  source text not null check (source in ('payment', 'manual')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_by_user_id uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoke_reason text
);

create unique index if not exists entitlements_order_id_key
  on public.entitlements (order_id)
  where order_id is not null;
create index if not exists entitlements_user_status_idx
  on public.entitlements (user_id, status, granted_at desc);
create index if not exists entitlements_product_id_idx
  on public.entitlements (product_id);

alter table public.entitlements enable row level security;

create policy "Clients can read their entitlements" on public.entitlements for select
  using (auth.uid() = user_id);
create policy "Admins can read all entitlements" on public.entitlements for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

revoke all on public.entitlements from anon, authenticated;
grant select on public.entitlements to authenticated;
grant all on public.entitlements to service_role;

insert into public.entitlements (user_id, product_id, order_id, source, granted_at)
select user_id, product_id, id, 'payment', coalesce(paid_at, created_at)
from public.orders
where payment_status = 'paid'
  and user_id is not null
  and product_id is not null
on conflict (order_id) where order_id is not null do nothing;

create table if not exists public.mcp_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'active' check (status in ('active', 'revoked')),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index if not exists mcp_keys_user_status_idx
  on public.mcp_keys (user_id, status, created_at desc);

alter table public.mcp_keys enable row level security;

create policy "Clients can read their MCP key status" on public.mcp_keys for select
  using (auth.uid() = user_id);
create policy "Admins can read MCP key status" on public.mcp_keys for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

revoke all on public.mcp_keys from anon, authenticated;
grant select (
  id,
  user_id,
  status,
  last_used_at,
  created_at,
  revoked_at
) on public.mcp_keys to authenticated;
grant all on public.mcp_keys to service_role;

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  status text not null default 'subscribed' check (status in ('subscribed', 'contacted', 'unsubscribed')),
  source text
);

create unique index if not exists waitlist_email_lower_key
  on public.waitlist (lower(email));
create index if not exists waitlist_created_at_idx
  on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;
grant all on public.waitlist to service_role;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  category text not null check (category in ('question', 'refund', 'other')),
  subject text not null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_tickets_user_created_idx
  on public.support_tickets (user_id, created_at desc);
create index if not exists support_tickets_status_created_idx
  on public.support_tickets (status, created_at desc);

alter table public.support_tickets enable row level security;

create policy "Clients can read their support tickets" on public.support_tickets for select
  using (auth.uid() = user_id);
create policy "Clients can create their support tickets" on public.support_tickets for insert
  with check (auth.uid() = user_id and status = 'open' and resolved_at is null);
create policy "Admins can read all support tickets" on public.support_tickets for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

revoke all on public.support_tickets from anon, authenticated;
grant select, insert on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;

create or replace function public.validate_support_ticket_order_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.order_id is not null and not exists (
    select 1
    from public.orders
    where orders.id = new.order_id
      and orders.user_id = new.user_id
  ) then
    raise exception 'Support ticket order does not belong to the ticket owner';
  end if;
  return new;
end;
$$;

create trigger validate_support_ticket_order_owner
before insert or update of order_id, user_id
on public.support_tickets
for each row execute function public.validate_support_ticket_order_owner();

create or replace function public.complete_saspay_order(
  p_order_id uuid,
  p_provider_payment_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.payment_status = 'paid' then
    if v_order.provider_payment_id = p_provider_payment_id then
      return;
    end if;
    raise exception 'Order is already associated with another payment';
  end if;

  if v_order.payment_status <> 'pending' then
    raise exception 'Order is not pending';
  end if;

  update public.orders
  set
    payment_status = 'paid',
    provider_payment_id = p_provider_payment_id,
    paid_at = now()
  where id = p_order_id;

  if v_order.user_id is not null and v_order.product_id is not null then
    insert into public.entitlements (user_id, product_id, order_id, source)
    values (v_order.user_id, v_order.product_id, v_order.id, 'payment')
    on conflict (order_id) where order_id is not null do nothing;
  end if;
end;
$$;

revoke all on function public.complete_saspay_order(uuid, text) from public, anon, authenticated;
grant execute on function public.complete_saspay_order(uuid, text) to service_role;
