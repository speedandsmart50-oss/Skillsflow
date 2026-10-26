alter table public.member_communities
  add column weekly_objective text not null default '' check (char_length(weekly_objective) <= 240),
  add column objective_week_start date;

grant update (weekly_objective, objective_week_start) on public.member_communities to authenticated;
