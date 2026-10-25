-- Store the server timestamp for the required legal acceptance at checkout.
alter table public.orders
  add column if not exists terms_accepted_at timestamptz;
