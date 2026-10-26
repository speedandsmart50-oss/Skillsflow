alter table public.profiles
  add column if not exists display_name text,
  add column if not exists avatar_path text,
  add column if not exists dashboard_theme text not null default 'midnight';

alter table public.profiles
  drop constraint if exists profiles_dashboard_theme_check;
alter table public.profiles
  add constraint profiles_dashboard_theme_check
  check (dashboard_theme in ('midnight', 'ocean', 'violet', 'light'));

-- Private bucket: avatar files are served only through short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('member-avatars', 'member-avatars', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
