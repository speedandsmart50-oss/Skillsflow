create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  price numeric(10,2) not null default 0,
  version text not null default '0.0.0',
  zip_path text,
  created_at timestamptz not null default now()
);

create table if not exists product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade,
  version text not null,
  release_notes text,
  zip_path text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  total numeric(10,2) not null,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  version text not null,
  signed_url text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table products enable row level security;
alter table product_versions enable row level security;
alter table orders enable row level security;
alter table downloads enable row level security;

create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Public product read access" on products for select using (status = 'published');
create policy "Admins manage products" on products for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
create policy "Public product version read access" on product_versions for select using (status = 'published');
create policy "Admins manage product versions" on product_versions for all
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'))
  with check (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
create policy "Customers view own orders" on orders for select using (auth.uid() = user_id);
create policy "Admins view all orders" on orders for select
  using (exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin'));
create policy "Users can view own downloads" on downloads for select using (auth.uid() = user_id);
