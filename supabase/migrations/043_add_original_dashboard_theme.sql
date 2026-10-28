alter table public.profiles
  drop constraint if exists profiles_dashboard_theme_check;

alter table public.profiles
  add constraint profiles_dashboard_theme_check
  check (dashboard_theme in ('midnight', 'original', 'ocean', 'violet', 'light'));
