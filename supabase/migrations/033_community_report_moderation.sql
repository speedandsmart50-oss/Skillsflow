grant update (status) on public.reports to authenticated;

drop policy if exists reports_staff_update on public.reports;
create policy reports_staff_update on public.reports
  for update to authenticated
  using (public.community_is_staff())
  with check (public.community_is_staff());
